"""
API routes for campaign editor (CRUD operations)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


# ============ Campaign Routes ============
@router.get("", response_model=List[schemas.Campaign])
def list_campaigns(db: Session = Depends(get_db)):
    """List all campaigns"""
    return db.query(models.Campaign).all()


@router.get("/{campaign_id}", response_model=schemas.Campaign)
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    """Get a specific campaign"""
    campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.post("", response_model=schemas.Campaign)
def create_campaign(campaign: schemas.CampaignCreate, db: Session = Depends(get_db)):
    """Create a new campaign"""
    db_campaign = models.Campaign(**campaign.dict())
    db.add(db_campaign)
    db.commit()
    db.refresh(db_campaign)
    return db_campaign


@router.patch("/{campaign_id}", response_model=schemas.Campaign)
def update_campaign(
    campaign_id: int,
    campaign_update: schemas.CampaignUpdate,
    db: Session = Depends(get_db)
):
    """Update a campaign"""
    db_campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not db_campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    for key, value in campaign_update.dict(exclude_unset=True).items():
        setattr(db_campaign, key, value)

    db.commit()
    db.refresh(db_campaign)
    return db_campaign


@router.delete("/{campaign_id}")
def delete_campaign(campaign_id: int, db: Session = Depends(get_db)):
    """Delete a campaign"""
    db_campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not db_campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    db.delete(db_campaign)
    db.commit()
    return {"message": "Campaign deleted"}


# ============ Location Routes ============
@router.get("/{campaign_id}/locations", response_model=List[schemas.Location])
def list_locations(campaign_id: int, db: Session = Depends(get_db)):
    """List all locations in a campaign"""
    return db.query(models.Location).filter(models.Location.campaign_id == campaign_id).all()


@router.post("/{campaign_id}/locations", response_model=schemas.Location)
def create_location(
    campaign_id: int,
    location: schemas.LocationCreate,
    db: Session = Depends(get_db)
):
    """Create a new location"""
    if location.campaign_id != campaign_id:
        raise HTTPException(status_code=400, detail="Campaign ID mismatch")

    db_location = models.Location(**location.dict())
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location


@router.patch("/locations/{location_id}", response_model=schemas.Location)
def update_location(
    location_id: int,
    location_update: schemas.LocationUpdate,
    db: Session = Depends(get_db)
):
    """Update a location"""
    db_location = db.query(models.Location).filter(models.Location.id == location_id).first()
    if not db_location:
        raise HTTPException(status_code=404, detail="Location not found")

    for key, value in location_update.dict(exclude_unset=True).items():
        setattr(db_location, key, value)

    db.commit()
    db.refresh(db_location)
    return db_location


@router.delete("/locations/{location_id}")
def delete_location(location_id: int, db: Session = Depends(get_db)):
    """Delete a location"""
    db_location = db.query(models.Location).filter(models.Location.id == location_id).first()
    if not db_location:
        raise HTTPException(status_code=404, detail="Location not found")

    db.delete(db_location)
    db.commit()
    return {"message": "Location deleted"}


# ============ NPC Routes ============
@router.get("/{campaign_id}/npcs", response_model=List[schemas.NPC])
def list_npcs(campaign_id: int, db: Session = Depends(get_db)):
    """List all NPCs in a campaign"""
    return db.query(models.NPC).filter(models.NPC.campaign_id == campaign_id).all()


@router.post("/{campaign_id}/npcs", response_model=schemas.NPC)
def create_npc(
    campaign_id: int,
    npc: schemas.NPCCreate,
    db: Session = Depends(get_db)
):
    """Create a new NPC"""
    if npc.campaign_id != campaign_id:
        raise HTTPException(status_code=400, detail="Campaign ID mismatch")

    db_npc = models.NPC(**npc.dict())
    db.add(db_npc)
    db.commit()
    db.refresh(db_npc)
    return db_npc


@router.patch("/npcs/{npc_id}", response_model=schemas.NPC)
def update_npc(
    npc_id: int,
    npc_update: schemas.NPCUpdate,
    db: Session = Depends(get_db)
):
    """Update an NPC"""
    db_npc = db.query(models.NPC).filter(models.NPC.id == npc_id).first()
    if not db_npc:
        raise HTTPException(status_code=404, detail="NPC not found")

    for key, value in npc_update.dict(exclude_unset=True).items():
        setattr(db_npc, key, value)

    db.commit()
    db.refresh(db_npc)
    return db_npc


@router.delete("/npcs/{npc_id}")
def delete_npc(npc_id: int, db: Session = Depends(get_db)):
    """Delete an NPC"""
    db_npc = db.query(models.NPC).filter(models.NPC.id == npc_id).first()
    if not db_npc:
        raise HTTPException(status_code=404, detail="NPC not found")

    db.delete(db_npc)
    db.commit()
    return {"message": "NPC deleted"}


# ============ Narrative Node Routes ============
@router.get("/{campaign_id}/nodes", response_model=List[schemas.NarrativeNode])
def list_nodes(campaign_id: int, db: Session = Depends(get_db)):
    """List all narrative nodes in a campaign"""
    return db.query(models.NarrativeNode).filter(
        models.NarrativeNode.campaign_id == campaign_id
    ).all()


@router.get("/nodes/{node_id}", response_model=schemas.NarrativeNode)
def get_node(node_id: int, db: Session = Depends(get_db)):
    """Get a specific narrative node"""
    node = db.query(models.NarrativeNode).filter(models.NarrativeNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.post("/{campaign_id}/nodes", response_model=schemas.NarrativeNode)
def create_node(
    campaign_id: int,
    node: schemas.NarrativeNodeCreate,
    db: Session = Depends(get_db)
):
    """Create a new narrative node"""
    if node.campaign_id != campaign_id:
        raise HTTPException(status_code=400, detail="Campaign ID mismatch")

    db_node = models.NarrativeNode(**node.dict())
    db.add(db_node)
    db.commit()
    db.refresh(db_node)
    return db_node


@router.patch("/nodes/{node_id}", response_model=schemas.NarrativeNode)
def update_node(
    node_id: int,
    node_update: schemas.NarrativeNodeUpdate,
    db: Session = Depends(get_db)
):
    """Update a narrative node"""
    db_node = db.query(models.NarrativeNode).filter(models.NarrativeNode.id == node_id).first()
    if not db_node:
        raise HTTPException(status_code=404, detail="Node not found")

    for key, value in node_update.dict(exclude_unset=True).items():
        setattr(db_node, key, value)

    db.commit()
    db.refresh(db_node)
    return db_node


@router.delete("/nodes/{node_id}")
def delete_node(node_id: int, db: Session = Depends(get_db)):
    """Delete a narrative node"""
    db_node = db.query(models.NarrativeNode).filter(models.NarrativeNode.id == node_id).first()
    if not db_node:
        raise HTTPException(status_code=404, detail="Node not found")

    db.delete(db_node)
    db.commit()
    return {"message": "Node deleted"}


# ============ Choice Routes ============
@router.post("/nodes/{node_id}/choices", response_model=schemas.Choice)
def create_choice(
    node_id: int,
    choice: schemas.ChoiceCreate,
    db: Session = Depends(get_db)
):
    """Create a new choice for a node"""
    if choice.node_id != node_id:
        raise HTTPException(status_code=400, detail="Node ID mismatch")

    # Verify node exists
    node = db.query(models.NarrativeNode).filter(models.NarrativeNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    db_choice = models.Choice(**choice.dict())
    db.add(db_choice)
    db.commit()
    db.refresh(db_choice)
    return db_choice


@router.patch("/choices/{choice_id}", response_model=schemas.Choice)
def update_choice(
    choice_id: int,
    choice_update: schemas.ChoiceUpdate,
    db: Session = Depends(get_db)
):
    """Update a choice"""
    db_choice = db.query(models.Choice).filter(models.Choice.id == choice_id).first()
    if not db_choice:
        raise HTTPException(status_code=404, detail="Choice not found")

    for key, value in choice_update.dict(exclude_unset=True).items():
        setattr(db_choice, key, value)

    db.commit()
    db.refresh(db_choice)
    return db_choice


@router.delete("/choices/{choice_id}")
def delete_choice(choice_id: int, db: Session = Depends(get_db)):
    """Delete a choice"""
    db_choice = db.query(models.Choice).filter(models.Choice.id == choice_id).first()
    if not db_choice:
        raise HTTPException(status_code=404, detail="Choice not found")

    db.delete(db_choice)
    db.commit()
    return {"message": "Choice deleted"}
