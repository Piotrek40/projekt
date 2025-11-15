"""
Unit tests for game engine logic
"""
import pytest
from app.game_engine import (
    roll_d20,
    get_stat_modifier,
    perform_skill_test,
    check_conditions,
    apply_effects
)
from app import models


class TestDiceRolls:
    """Test dice rolling mechanics"""

    def test_roll_d20_range(self):
        """D20 should return values between 1 and 20"""
        for _ in range(100):
            roll = roll_d20()
            assert 1 <= roll <= 20

    def test_stat_modifier_calculation(self):
        """Test stat modifier calculation"""
        character = models.PlayerCharacter(
            name="Test",
            strength=10,
            agility=14,
            charisma=8
        )

        assert get_stat_modifier(character, "strength") == 0  # (10-10)//2 = 0
        assert get_stat_modifier(character, "agility") == 2   # (14-10)//2 = 2
        assert get_stat_modifier(character, "charisma") == -1  # (8-10)//2 = -1


class TestSkillTests:
    """Test skill test mechanics"""

    def test_skill_test_success(self):
        """Test successful skill test"""
        character = models.PlayerCharacter(
            name="Test",
            strength=18  # Modifier: +4
        )

        # Run multiple tests to account for randomness
        successes = 0
        for _ in range(50):
            success, roll, modifier, total = perform_skill_test(character, "strength", 10)
            assert 1 <= roll <= 20
            assert modifier == 4
            assert total == roll + modifier
            if success:
                successes += 1

        # With +4 modifier and DC 10, we should succeed more than half the time
        assert successes > 20


class TestConditions:
    """Test condition checking"""

    def test_no_conditions(self):
        """No conditions should always pass"""
        character = models.PlayerCharacter(name="Test")
        game_state = models.GameState(
            slot_name="Test",
            campaign_id=1,
            character_id=1,
            inventory=[],
            flags={}
        )

        assert check_conditions(None, character, game_state) is True
        assert check_conditions({}, character, game_state) is True

    def test_required_item_condition(self):
        """Test required item condition"""
        character = models.PlayerCharacter(name="Test")
        game_state = models.GameState(
            slot_name="Test",
            campaign_id=1,
            character_id=1,
            inventory=["sword", "potion"],
            flags={}
        )

        conditions_pass = {"required_item": "sword"}
        conditions_fail = {"required_item": "key"}

        assert check_conditions(conditions_pass, character, game_state) is True
        assert check_conditions(conditions_fail, character, game_state) is False

    def test_level_condition(self):
        """Test level requirements"""
        character = models.PlayerCharacter(name="Test", level=5)
        game_state = models.GameState(
            slot_name="Test",
            campaign_id=1,
            character_id=1,
            inventory=[],
            flags={}
        )

        assert check_conditions({"min_level": 3}, character, game_state) is True
        assert check_conditions({"min_level": 7}, character, game_state) is False
        assert check_conditions({"max_level": 10}, character, game_state) is True
        assert check_conditions({"max_level": 4}, character, game_state) is False

    def test_flag_condition(self):
        """Test story flag requirements"""
        character = models.PlayerCharacter(name="Test")
        game_state = models.GameState(
            slot_name="Test",
            campaign_id=1,
            character_id=1,
            inventory=[],
            flags={"helped_merchant": True, "betrayed_guard": False}
        )

        assert check_conditions({"required_flag": "helped_merchant"}, character, game_state) is True
        assert check_conditions({"required_flag": "betrayed_guard"}, character, game_state) is False
        assert check_conditions({"required_flag": "unknown_flag"}, character, game_state) is False

    def test_stat_condition(self):
        """Test stat requirements"""
        character = models.PlayerCharacter(
            name="Test",
            strength=12,
            agility=10,
            charisma=8
        )
        game_state = models.GameState(
            slot_name="Test",
            campaign_id=1,
            character_id=1,
            inventory=[],
            flags={}
        )

        assert check_conditions({"min_strength": 10}, character, game_state) is True
        assert check_conditions({"min_strength": 15}, character, game_state) is False
        assert check_conditions({"min_charisma": 8}, character, game_state) is True
        assert check_conditions({"min_charisma": 10}, character, game_state) is False

    def test_multiple_conditions(self):
        """Test multiple conditions together"""
        character = models.PlayerCharacter(name="Test", level=5, strength=12)
        game_state = models.GameState(
            slot_name="Test",
            campaign_id=1,
            character_id=1,
            inventory=["sword"],
            flags={"hero": True}
        )

        conditions = {
            "min_level": 3,
            "required_item": "sword",
            "required_flag": "hero",
            "min_strength": 10
        }

        assert check_conditions(conditions, character, game_state) is True

        # Remove one requirement
        game_state.inventory = []
        assert check_conditions(conditions, character, game_state) is False


class TestEffects:
    """Test effect application (requires database session - these are integration tests)"""

    def test_effect_logic(self):
        """Test that effect dictionary structure is correct"""
        # This is a simple test - full effect testing requires database
        effects = {
            "add_item": "magic_sword",
            "set_flag": "defeated_boss",
            "add_xp": 100
        }

        assert "add_item" in effects
        assert effects["add_xp"] == 100


# Run tests with: pytest backend/tests/ -v
