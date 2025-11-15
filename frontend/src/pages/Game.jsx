import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function Game() {
  const [gameState, setGameState] = useState(null);
  const [character, setCharacter] = useState(null);
  const [currentNode, setCurrentNode] = useState(null);
  const [choices, setChoices] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [savedGames, setSavedGames] = useState([]);
  const [showNewGame, setShowNewGame] = useState(false);
  const [showLoadGame, setShowLoadGame] = useState(false);
  const [skillTestResult, setSkillTestResult] = useState(null);

  const [newGameForm, setNewGameForm] = useState({
    campaign_id: '',
    character_name: '',
    slot_name: '',
    strength: 10,
    agility: 10,
    charisma: 10,
  });

  useEffect(() => {
    loadCampaigns();
    loadSavedGames();
  }, []);

  const loadCampaigns = async () => {
    try {
      const data = await api.getCampaigns();
      setCampaigns(data);
      if (data.length > 0) {
        setNewGameForm(prev => ({ ...prev, campaign_id: data[0].id }));
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    }
  };

  const loadSavedGames = async () => {
    try {
      const data = await api.getGameStates();
      setSavedGames(data);
    } catch (error) {
      console.error('Failed to load saved games:', error);
    }
  };

  const startNewGame = async (e) => {
    e.preventDefault();
    try {
      const response = await api.startGame(newGameForm);
      setGameState(response.game_state);
      setCharacter(response.character);
      setCurrentNode(response.current_node);
      setChoices(response.available_choices);
      setSkillTestResult(null);
      setShowNewGame(false);
    } catch (error) {
      console.error('Failed to start game:', error);
      alert('Failed to start game. Make sure the backend is running.');
    }
  };

  const loadGame = async (gameStateId) => {
    try {
      const response = await api.loadGame(gameStateId);
      setGameState(response.game_state);
      setCharacter(response.character);
      setCurrentNode(response.current_node);
      setChoices(response.available_choices);
      setSkillTestResult(null);
      setShowLoadGame(false);
    } catch (error) {
      console.error('Failed to load game:', error);
      alert('Failed to load game.');
    }
  };

  const makeChoice = async (choiceId) => {
    try {
      const response = await api.makeChoice({
        game_state_id: gameState.id,
        choice_id: choiceId,
      });
      setGameState(response.game_state);
      setCharacter(response.character);
      setCurrentNode(response.current_node);
      setChoices(response.available_choices);
      setSkillTestResult(response.skill_test_result || null);
    } catch (error) {
      console.error('Failed to make choice:', error);
      alert('Failed to make choice.');
    }
  };

  const deleteGame = async (gameStateId) => {
    if (!confirm('Are you sure you want to delete this saved game?')) return;
    try {
      await api.deleteGameState(gameStateId);
      loadSavedGames();
      if (gameState?.id === gameStateId) {
        setGameState(null);
        setCharacter(null);
        setCurrentNode(null);
        setChoices([]);
      }
    } catch (error) {
      console.error('Failed to delete game:', error);
    }
  };

  // Main Menu
  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-white">Game</h1>
            <Link to="/" className="text-purple-400 hover:text-purple-300">
              ← Back to Home
            </Link>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <button
              onClick={() => setShowNewGame(!showNewGame)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 px-8 rounded-lg text-xl transition"
            >
              New Game
            </button>
            <button
              onClick={() => setShowLoadGame(!showLoadGame)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 px-8 rounded-lg text-xl transition"
            >
              Load Game
            </button>
          </div>

          {/* New Game Form */}
          {showNewGame && (
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-white mb-4">Start New Game</h2>
              <form onSubmit={startNewGame} className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-2">Campaign</label>
                  <select
                    value={newGameForm.campaign_id}
                    onChange={(e) => setNewGameForm({ ...newGameForm, campaign_id: parseInt(e.target.value) })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                    required
                  >
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Character Name</label>
                  <input
                    type="text"
                    value={newGameForm.character_name}
                    onChange={(e) => setNewGameForm({ ...newGameForm, character_name: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Save Slot Name</label>
                  <input
                    type="text"
                    value={newGameForm.slot_name}
                    onChange={(e) => setNewGameForm({ ...newGameForm, slot_name: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-300 mb-2">Strength</label>
                    <input
                      type="number"
                      value={newGameForm.strength}
                      onChange={(e) => setNewGameForm({ ...newGameForm, strength: parseInt(e.target.value) })}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                      min="8"
                      max="18"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-2">Agility</label>
                    <input
                      type="number"
                      value={newGameForm.agility}
                      onChange={(e) => setNewGameForm({ ...newGameForm, agility: parseInt(e.target.value) })}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                      min="8"
                      max="18"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-2">Charisma</label>
                    <input
                      type="number"
                      value={newGameForm.charisma}
                      onChange={(e) => setNewGameForm({ ...newGameForm, charisma: parseInt(e.target.value) })}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                      min="8"
                      max="18"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded transition"
                >
                  Start Adventure
                </button>
              </form>
            </div>
          )}

          {/* Load Game List */}
          {showLoadGame && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Load Saved Game</h2>
              {savedGames.length === 0 ? (
                <p className="text-gray-400">No saved games found.</p>
              ) : (
                <div className="space-y-3">
                  {savedGames.map(save => (
                    <div key={save.id} className="bg-gray-700 p-4 rounded flex justify-between items-center">
                      <div>
                        <div className="text-white font-bold">{save.slot_name}</div>
                        <div className="text-gray-400 text-sm">
                          Last saved: {save.last_saved ? new Date(save.last_saved).toLocaleString() : 'Unknown'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => loadGame(save.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => deleteGame(save.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // In-Game View
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-gray-800/80 rounded-lg p-4 mb-6 flex justify-between items-center">
          <div className="flex gap-6">
            <div>
              <div className="text-gray-400 text-sm">Character</div>
              <div className="text-white font-bold">{character?.name}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Level</div>
              <div className="text-white font-bold">{character?.level}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">XP</div>
              <div className="text-white font-bold">{character?.experience}</div>
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm('Return to main menu? (Progress is auto-saved)')) {
                setGameState(null);
                setCharacter(null);
                setCurrentNode(null);
                setChoices([]);
                loadSavedGames();
              }
            }}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition"
          >
            Main Menu
          </button>
        </div>

        {/* Character Stats */}
        <div className="bg-gray-800/80 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-gray-400 text-sm">Strength</div>
              <div className="text-white font-bold text-xl">{character?.strength}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Agility</div>
              <div className="text-white font-bold text-xl">{character?.agility}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Charisma</div>
              <div className="text-white font-bold text-xl">{character?.charisma}</div>
            </div>
          </div>
        </div>

        {/* Skill Test Result */}
        {skillTestResult && (
          <div className={`rounded-lg p-6 mb-6 ${skillTestResult.success ? 'bg-green-900/50 border-2 border-green-500' : 'bg-red-900/50 border-2 border-red-500'}`}>
            <h3 className="text-2xl font-bold text-white mb-2">
              {skillTestResult.success ? '✓ Success!' : '✗ Failed!'}
            </h3>
            <div className="text-gray-300">
              <div>Roll: {skillTestResult.roll} + {skillTestResult.modifier} (modifier) = {skillTestResult.total}</div>
              <div>Difficulty: {skillTestResult.difficulty}</div>
              <div className="mt-2 font-semibold">
                {skillTestResult.success ? 'You succeeded!' : 'You failed the test.'}
              </div>
            </div>
          </div>
        )}

        {/* Current Node */}
        <div className="bg-gray-800/90 rounded-lg p-8 mb-6">
          <h2 className="text-3xl font-bold text-white mb-4">{currentNode?.title}</h2>
          {currentNode?.is_ending && (
            <div className="mb-4 inline-block bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold">
              ENDING: {currentNode.ending_type}
            </div>
          )}
          <div className="text-gray-200 text-lg whitespace-pre-wrap leading-relaxed">
            {currentNode?.description}
          </div>
        </div>

        {/* Choices */}
        {!currentNode?.is_ending && choices.length > 0 && (
          <div className="space-y-3">
            {choices.map((choice) => (
              <button
                key={choice.id}
                onClick={() => makeChoice(choice.id)}
                className="w-full bg-purple-700/50 hover:bg-purple-600 text-white p-4 rounded-lg text-left transition border-2 border-purple-500/30 hover:border-purple-400"
              >
                <div className="font-semibold">{choice.text}</div>
                {choice.conditions && Object.keys(choice.conditions).length > 0 && (
                  <div className="text-sm text-purple-300 mt-1">
                    Requirements: {JSON.stringify(choice.conditions)}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Ending - Return to Menu */}
        {currentNode?.is_ending && (
          <div className="text-center">
            <button
              onClick={() => {
                setGameState(null);
                setCharacter(null);
                setCurrentNode(null);
                setChoices([]);
                loadSavedGames();
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition"
            >
              Return to Main Menu
            </button>
          </div>
        )}

        {/* Inventory & Flags (collapsed by default) */}
        <div className="mt-8 bg-gray-800/50 rounded-lg p-4">
          <details>
            <summary className="text-white font-bold cursor-pointer">Inventory & Story Flags</summary>
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-gray-400 text-sm mb-2">Inventory</div>
                <div className="text-white">
                  {gameState?.inventory?.length > 0 ? (
                    <ul className="list-disc list-inside">
                      {gameState.inventory.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-gray-500">Empty</div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-sm mb-2">Story Flags</div>
                <div className="text-white">
                  {gameState?.flags && Object.keys(gameState.flags).length > 0 ? (
                    <ul className="list-disc list-inside">
                      {Object.entries(gameState.flags).map(([key, value]) => (
                        <li key={key}>{key}: {value ? 'true' : 'false'}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-gray-500">None</div>
                  )}
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
