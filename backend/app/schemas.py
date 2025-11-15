"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


# ============ Campaign Schemas ============
class CampaignBase(BaseModel):
    name: str
    description: Optional[str] = None
    start_node_id: Optional[int] = None


class CampaignCreate(CampaignBase):
    pass


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_node_id: Optional[int] = None


class Campaign(CampaignBase):
    id: int

    class Config:
        from_attributes = True


# ============ Location Schemas ============
class LocationBase(BaseModel):
    name: str
    description: Optional[str] = None
    campaign_id: int


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class Location(LocationBase):
    id: int

    class Config:
        from_attributes = True


# ============ NPC Schemas ============
class NPCBase(BaseModel):
    name: str
    description: Optional[str] = None
    role: Optional[str] = None
    campaign_id: int
    location_id: Optional[int] = None


class NPCCreate(NPCBase):
    pass


class NPCUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    role: Optional[str] = None
    location_id: Optional[int] = None


class NPC(NPCBase):
    id: int

    class Config:
        from_attributes = True


# ============ Choice Schemas ============
class ChoiceBase(BaseModel):
    text: str
    target_node_id: Optional[int] = None
    order: int = 0
    conditions: Optional[Dict[str, Any]] = None
    effects: Optional[Dict[str, Any]] = None


class ChoiceCreate(ChoiceBase):
    node_id: int


class ChoiceUpdate(BaseModel):
    text: Optional[str] = None
    target_node_id: Optional[int] = None
    order: Optional[int] = None
    conditions: Optional[Dict[str, Any]] = None
    effects: Optional[Dict[str, Any]] = None


class Choice(ChoiceBase):
    id: int
    node_id: int

    class Config:
        from_attributes = True


# ============ Narrative Node Schemas ============
class NarrativeNodeBase(BaseModel):
    title: str
    description: str
    node_type: str = "story"
    campaign_id: int
    location_id: Optional[int] = None
    skill_test_stat: Optional[str] = None
    skill_test_difficulty: Optional[int] = None
    success_node_id: Optional[int] = None
    failure_node_id: Optional[int] = None
    is_ending: bool = False
    ending_type: Optional[str] = None


class NarrativeNodeCreate(NarrativeNodeBase):
    pass


class NarrativeNodeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    node_type: Optional[str] = None
    location_id: Optional[int] = None
    skill_test_stat: Optional[str] = None
    skill_test_difficulty: Optional[int] = None
    success_node_id: Optional[int] = None
    failure_node_id: Optional[int] = None
    is_ending: Optional[bool] = None
    ending_type: Optional[str] = None


class NarrativeNode(NarrativeNodeBase):
    id: int
    choices: List[Choice] = []

    class Config:
        from_attributes = True


# ============ Player Character Schemas ============
class PlayerCharacterBase(BaseModel):
    name: str
    strength: int = 10
    agility: int = 10
    charisma: int = 10
    level: int = 1
    experience: int = 0


class PlayerCharacterCreate(PlayerCharacterBase):
    pass


class PlayerCharacterUpdate(BaseModel):
    name: Optional[str] = None
    strength: Optional[int] = None
    agility: Optional[int] = None
    charisma: Optional[int] = None
    level: Optional[int] = None
    experience: Optional[int] = None


class PlayerCharacter(PlayerCharacterBase):
    id: int

    class Config:
        from_attributes = True


# ============ Game State Schemas ============
class GameStateBase(BaseModel):
    slot_name: str
    campaign_id: int
    character_id: int
    current_node_id: Optional[int] = None
    inventory: List[str] = []
    flags: Dict[str, bool] = {}


class GameStateCreate(GameStateBase):
    pass


class GameStateUpdate(BaseModel):
    current_node_id: Optional[int] = None
    inventory: Optional[List[str]] = None
    flags: Optional[Dict[str, bool]] = None


class GameState(GameStateBase):
    id: int
    last_saved: Optional[str] = None

    class Config:
        from_attributes = True


# ============ Game Play Schemas ============
class StartGameRequest(BaseModel):
    campaign_id: int
    character_name: str
    slot_name: str
    # Optional starting stats
    strength: int = 10
    agility: int = 10
    charisma: int = 10


class MakeChoiceRequest(BaseModel):
    game_state_id: int
    choice_id: int


class SkillTestResult(BaseModel):
    success: bool
    roll: int
    modifier: int
    total: int
    difficulty: int
    next_node_id: int


class GamePlayResponse(BaseModel):
    """Response for current game state during play"""
    game_state: GameState
    character: PlayerCharacter
    current_node: NarrativeNode
    available_choices: List[Choice]
    skill_test_result: Optional[SkillTestResult] = None
