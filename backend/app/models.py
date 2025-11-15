"""
SQLAlchemy models for the RPG Narrative Engine
"""
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class Campaign(Base):
    """Represents a game campaign"""
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    start_node_id = Column(Integer, nullable=True)  # ID of the starting narrative node

    # Relationships
    locations = relationship("Location", back_populates="campaign", cascade="all, delete-orphan")
    npcs = relationship("NPC", back_populates="campaign", cascade="all, delete-orphan")
    nodes = relationship("NarrativeNode", back_populates="campaign", cascade="all, delete-orphan")
    game_states = relationship("GameState", back_populates="campaign", cascade="all, delete-orphan")


class Location(Base):
    """Represents a location in the game world"""
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # Relationships
    campaign = relationship("Campaign", back_populates="locations")
    npcs = relationship("NPC", back_populates="location")
    nodes = relationship("NarrativeNode", back_populates="location")


class NPC(Base):
    """Represents a non-player character"""
    __tablename__ = "npcs"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    role = Column(String(100), nullable=True)  # e.g., "merchant", "guard", "quest_giver"

    # Relationships
    campaign = relationship("Campaign", back_populates="npcs")
    location = relationship("Location", back_populates="npcs")


class NarrativeNode(Base):
    """Represents a narrative node (scene/dialogue) in the story"""
    __tablename__ = "narrative_nodes"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)  # Main narrative text
    node_type = Column(String(50), default="story")  # story, dialogue, combat, skill_test, ending

    # For skill tests
    skill_test_stat = Column(String(50), nullable=True)  # strength, agility, charisma
    skill_test_difficulty = Column(Integer, nullable=True)
    success_node_id = Column(Integer, nullable=True)  # Node to go to on success
    failure_node_id = Column(Integer, nullable=True)  # Node to go to on failure

    # For endings
    is_ending = Column(Boolean, default=False)
    ending_type = Column(String(100), nullable=True)  # "sacrifice", "escape", "triumph", etc.

    # Relationships
    campaign = relationship("Campaign", back_populates="nodes")
    location = relationship("Location", back_populates="nodes")
    choices = relationship("Choice", back_populates="node", cascade="all, delete-orphan")


class Choice(Base):
    """Represents a player choice in a narrative node"""
    __tablename__ = "choices"

    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(Integer, ForeignKey("narrative_nodes.id"), nullable=False)

    text = Column(String(500), nullable=False)  # Text displayed to player
    target_node_id = Column(Integer, nullable=True)  # Where this choice leads
    order = Column(Integer, default=0)  # Display order

    # Conditions (stored as JSON)
    # Example: {"required_item": "rusty_key", "min_level": 3, "required_flag": "helped_merchant"}
    conditions = Column(JSON, nullable=True)

    # Effects (stored as JSON)
    # Example: {"add_item": "sacred_amulet", "set_flag": "betrayed_guards", "add_xp": 100}
    effects = Column(JSON, nullable=True)

    # Relationships
    node = relationship("NarrativeNode", back_populates="choices")


class PlayerCharacter(Base):
    """Represents a player character"""
    __tablename__ = "player_characters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)

    # Stats
    strength = Column(Integer, default=10)
    agility = Column(Integer, default=10)
    charisma = Column(Integer, default=10)

    # Progression
    level = Column(Integer, default=1)
    experience = Column(Integer, default=0)

    # Relationships
    game_states = relationship("GameState", back_populates="character")


class GameState(Base):
    """Represents a saved game state"""
    __tablename__ = "game_states"

    id = Column(Integer, primary_key=True, index=True)
    slot_name = Column(String(200), nullable=False)  # e.g., "Slot 1", "Quick Save"

    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    character_id = Column(Integer, ForeignKey("player_characters.id"), nullable=False)
    current_node_id = Column(Integer, nullable=True)

    # Inventory (stored as JSON list of item names)
    # Example: ["rusty_sword", "health_potion", "mysterious_key"]
    inventory = Column(JSON, default=list)

    # Story flags (stored as JSON dict)
    # Example: {"helped_merchant": true, "betrayed_guards": true, "knows_secret": false}
    flags = Column(JSON, default=dict)

    # Last save timestamp
    last_saved = Column(String(50), nullable=True)

    # Relationships
    campaign = relationship("Campaign", back_populates="game_states")
    character = relationship("PlayerCharacter", back_populates="game_states")
