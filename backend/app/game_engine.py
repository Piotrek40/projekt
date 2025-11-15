"""
Game engine logic for RPG Narrative Engine
Handles skill tests, condition checking, choice effects, etc.
"""
import random
from typing import Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from . import models


def roll_d20() -> int:
    """Roll a 20-sided die"""
    return random.randint(1, 20)


def get_stat_modifier(character: models.PlayerCharacter, stat_name: str) -> int:
    """
    Get the modifier for a stat (simplified: (stat - 10) // 2)
    """
    stat_value = getattr(character, stat_name.lower(), 10)
    return (stat_value - 10) // 2


def perform_skill_test(
    character: models.PlayerCharacter,
    stat_name: str,
    difficulty: int
) -> Tuple[bool, int, int, int]:
    """
    Perform a skill test

    Returns:
        (success, roll, modifier, total)
    """
    roll = roll_d20()
    modifier = get_stat_modifier(character, stat_name)
    total = roll + modifier
    success = total >= difficulty

    return success, roll, modifier, total


def check_conditions(
    conditions: Optional[Dict[str, Any]],
    character: models.PlayerCharacter,
    game_state: models.GameState
) -> bool:
    """
    Check if choice conditions are met

    Supported conditions:
    - required_item: "item_name"
    - min_level: 3
    - max_level: 5
    - required_flag: "flag_name"
    - min_strength/agility/charisma: value
    """
    if not conditions:
        return True

    # Check required item
    if "required_item" in conditions:
        if conditions["required_item"] not in game_state.inventory:
            return False

    # Check minimum level
    if "min_level" in conditions:
        if character.level < conditions["min_level"]:
            return False

    # Check maximum level
    if "max_level" in conditions:
        if character.level > conditions["max_level"]:
            return False

    # Check required flag
    if "required_flag" in conditions:
        flag_name = conditions["required_flag"]
        if not game_state.flags.get(flag_name, False):
            return False

    # Check stat requirements
    for stat in ["strength", "agility", "charisma"]:
        min_key = f"min_{stat}"
        if min_key in conditions:
            if getattr(character, stat) < conditions[min_key]:
                return False

    return True


def apply_effects(
    effects: Optional[Dict[str, Any]],
    character: models.PlayerCharacter,
    game_state: models.GameState,
    db: Session
) -> None:
    """
    Apply choice effects to character and game state

    Supported effects:
    - add_item: "item_name"
    - remove_item: "item_name"
    - set_flag: "flag_name"
    - unset_flag: "flag_name"
    - add_xp: 100
    - add_strength/agility/charisma: value
    """
    if not effects:
        return

    # Add item to inventory
    if "add_item" in effects:
        item = effects["add_item"]
        if item not in game_state.inventory:
            game_state.inventory.append(item)

    # Remove item from inventory
    if "remove_item" in effects:
        item = effects["remove_item"]
        if item in game_state.inventory:
            game_state.inventory.remove(item)

    # Set story flag
    if "set_flag" in effects:
        flag_name = effects["set_flag"]
        game_state.flags[flag_name] = True

    # Unset story flag
    if "unset_flag" in effects:
        flag_name = effects["unset_flag"]
        game_state.flags[flag_name] = False

    # Add experience
    if "add_xp" in effects:
        character.experience += effects["add_xp"]
        # Simple level up: every 100 XP = 1 level
        new_level = 1 + (character.experience // 100)
        if new_level > character.level:
            character.level = new_level

    # Modify stats
    for stat in ["strength", "agility", "charisma"]:
        add_key = f"add_{stat}"
        if add_key in effects:
            current = getattr(character, stat)
            setattr(character, stat, current + effects[add_key])

    # Commit changes
    db.commit()
    db.refresh(character)
    db.refresh(game_state)


def get_available_choices(
    node: models.NarrativeNode,
    character: models.PlayerCharacter,
    game_state: models.GameState
) -> list:
    """
    Get choices that are available based on current conditions
    """
    available = []
    for choice in node.choices:
        if check_conditions(choice.conditions, character, game_state):
            available.append(choice)

    # Sort by order
    available.sort(key=lambda c: c.order)
    return available


def calculate_next_node(
    choice: models.Choice,
    node: models.NarrativeNode,
    character: models.PlayerCharacter,
    db: Session
) -> Tuple[Optional[int], Optional[Dict[str, Any]]]:
    """
    Calculate the next node based on choice and any skill tests

    Returns:
        (next_node_id, skill_test_result_dict or None)
    """
    # If the current node is a skill test, perform it
    if node.node_type == "skill_test" and node.skill_test_stat:
        success, roll, modifier, total = perform_skill_test(
            character,
            node.skill_test_stat,
            node.skill_test_difficulty or 10
        )

        next_node_id = node.success_node_id if success else node.failure_node_id

        skill_test_result = {
            "success": success,
            "roll": roll,
            "modifier": modifier,
            "total": total,
            "difficulty": node.skill_test_difficulty or 10,
            "stat": node.skill_test_stat
        }

        return next_node_id, skill_test_result

    # Otherwise, use the choice's target node
    return choice.target_node_id, None
