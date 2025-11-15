"""
API routes for game play
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from .. import models, schemas
from ..db import get_db
from ..game_engine import (
    get_available_choices,
    apply_effects,
    calculate_next_node,
    perform_skill_test
)

router = APIRouter(prefix="/api/game", tags=["game"])


@router.post("/start", response_model=schemas.GamePlayResponse)
def start_game(request: schemas.StartGameRequest, db: Session = Depends(get_db)):
    """
    Start a new game
    Creates a new character and game state
    """
    # Verify campaign exists
    campaign = db.query(models.Campaign).filter(
        models.Campaign.id == request.campaign_id
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if not campaign.start_node_id:
        raise HTTPException(status_code=400, detail="Campaign has no start node")

    # Create character
    character = models.PlayerCharacter(
        name=request.character_name,
        strength=request.strength,
        agility=request.agility,
        charisma=request.charisma
    )
    db.add(character)
    db.commit()
    db.refresh(character)

    # Create game state
    game_state = models.GameState(
        slot_name=request.slot_name,
        campaign_id=request.campaign_id,
        character_id=character.id,
        current_node_id=campaign.start_node_id,
        inventory=[],
        flags={},
        last_saved=datetime.now().isoformat()
    )
    db.add(game_state)
    db.commit()
    db.refresh(game_state)

    # Get current node
    current_node = db.query(models.NarrativeNode).filter(
        models.NarrativeNode.id == campaign.start_node_id
    ).first()

    # Get available choices
    available_choices = get_available_choices(current_node, character, game_state)

    return schemas.GamePlayResponse(
        game_state=game_state,
        character=character,
        current_node=current_node,
        available_choices=available_choices
    )


@router.get("/states", response_model=List[schemas.GameState])
def list_game_states(db: Session = Depends(get_db)):
    """List all saved game states"""
    return db.query(models.GameState).all()


@router.get("/states/{game_state_id}", response_model=schemas.GamePlayResponse)
def load_game(game_state_id: int, db: Session = Depends(get_db)):
    """Load an existing game state"""
    game_state = db.query(models.GameState).filter(
        models.GameState.id == game_state_id
    ).first()
    if not game_state:
        raise HTTPException(status_code=404, detail="Game state not found")

    character = db.query(models.PlayerCharacter).filter(
        models.PlayerCharacter.id == game_state.character_id
    ).first()

    current_node = db.query(models.NarrativeNode).filter(
        models.NarrativeNode.id == game_state.current_node_id
    ).first()

    available_choices = get_available_choices(current_node, character, game_state)

    return schemas.GamePlayResponse(
        game_state=game_state,
        character=character,
        current_node=current_node,
        available_choices=available_choices
    )


@router.post("/choice", response_model=schemas.GamePlayResponse)
def make_choice(request: schemas.MakeChoiceRequest, db: Session = Depends(get_db)):
    """
    Make a choice in the game
    This advances the story and applies any effects
    """
    # Load game state
    game_state = db.query(models.GameState).filter(
        models.GameState.id == request.game_state_id
    ).first()
    if not game_state:
        raise HTTPException(status_code=404, detail="Game state not found")

    # Load character
    character = db.query(models.PlayerCharacter).filter(
        models.PlayerCharacter.id == game_state.character_id
    ).first()

    # Load current node
    current_node = db.query(models.NarrativeNode).filter(
        models.NarrativeNode.id == game_state.current_node_id
    ).first()

    # Load choice
    choice = db.query(models.Choice).filter(
        models.Choice.id == request.choice_id
    ).first()
    if not choice:
        raise HTTPException(status_code=404, detail="Choice not found")

    # Verify choice belongs to current node
    if choice.node_id != current_node.id:
        raise HTTPException(status_code=400, detail="Choice does not belong to current node")

    # Apply choice effects
    apply_effects(choice.effects, character, game_state, db)

    # Calculate next node (may involve skill test)
    next_node_id, skill_test_result = calculate_next_node(
        choice, current_node, character, db
    )

    if not next_node_id:
        raise HTTPException(status_code=400, detail="No next node defined")

    # Update game state
    game_state.current_node_id = next_node_id
    game_state.last_saved = datetime.now().isoformat()
    db.commit()
    db.refresh(game_state)

    # Load new current node
    new_current_node = db.query(models.NarrativeNode).filter(
        models.NarrativeNode.id == next_node_id
    ).first()

    # Get available choices for new node
    available_choices = get_available_choices(new_current_node, character, game_state)

    return schemas.GamePlayResponse(
        game_state=game_state,
        character=character,
        current_node=new_current_node,
        available_choices=available_choices,
        skill_test_result=skill_test_result
    )


@router.delete("/states/{game_state_id}")
def delete_game_state(game_state_id: int, db: Session = Depends(get_db)):
    """Delete a saved game"""
    game_state = db.query(models.GameState).filter(
        models.GameState.id == game_state_id
    ).first()
    if not game_state:
        raise HTTPException(status_code=404, detail="Game state not found")

    # Also delete the associated character
    character = db.query(models.PlayerCharacter).filter(
        models.PlayerCharacter.id == game_state.character_id
    ).first()

    db.delete(game_state)
    if character:
        db.delete(character)
    db.commit()

    return {"message": "Game state deleted"}


@router.post("/save/{game_state_id}")
def save_game(game_state_id: int, db: Session = Depends(get_db)):
    """
    Manually save the game (update last_saved timestamp)
    """
    game_state = db.query(models.GameState).filter(
        models.GameState.id == game_state_id
    ).first()
    if not game_state:
        raise HTTPException(status_code=404, detail="Game state not found")

    game_state.last_saved = datetime.now().isoformat()
    db.commit()
    db.refresh(game_state)

    return {"message": "Game saved", "last_saved": game_state.last_saved}
