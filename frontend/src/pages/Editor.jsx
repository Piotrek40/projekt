import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function Editor() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [tab, setTab] = useState('campaigns'); // campaigns, locations, npcs, nodes
  const [locations, setLocations] = useState([]);
  const [npcs, setNpcs] = useState([]);
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaign) {
      loadCampaignData();
    }
  }, [selectedCampaign]);

  const loadCampaigns = async () => {
    try {
      const data = await api.getCampaigns();
      setCampaigns(data);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    }
  };

  const loadCampaignData = async () => {
    if (!selectedCampaign) return;
    try {
      const [locs, npcsData, nodesData] = await Promise.all([
        api.getLocations(selectedCampaign.id),
        api.getNPCs(selectedCampaign.id),
        api.getNodes(selectedCampaign.id),
      ]);
      setLocations(locs);
      setNpcs(npcsData);
      setNodes(nodesData);
    } catch (error) {
      console.error('Failed to load campaign data:', error);
    }
  };

  const createCampaign = async () => {
    const name = prompt('Campaign name:');
    if (!name) return;
    const description = prompt('Campaign description:');
    try {
      await api.createCampaign({ name, description });
      loadCampaigns();
    } catch (error) {
      console.error('Failed to create campaign:', error);
    }
  };

  const deleteCampaign = async (id) => {
    if (!confirm('Delete this campaign? This will delete all associated data!')) return;
    try {
      await api.deleteCampaign(id);
      loadCampaigns();
      if (selectedCampaign?.id === id) {
        setSelectedCampaign(null);
      }
    } catch (error) {
      console.error('Failed to delete campaign:', error);
    }
  };

  const createLocation = async () => {
    if (!selectedCampaign) return;
    const name = prompt('Location name:');
    if (!name) return;
    const description = prompt('Location description:');
    try {
      await api.createLocation(selectedCampaign.id, {
        name,
        description,
        campaign_id: selectedCampaign.id,
      });
      loadCampaignData();
    } catch (error) {
      console.error('Failed to create location:', error);
    }
  };

  const deleteLocation = async (id) => {
    if (!confirm('Delete this location?')) return;
    try {
      await api.deleteLocation(id);
      loadCampaignData();
    } catch (error) {
      console.error('Failed to delete location:', error);
    }
  };

  const createNPC = async () => {
    if (!selectedCampaign) return;
    const name = prompt('NPC name:');
    if (!name) return;
    const description = prompt('NPC description:');
    const role = prompt('NPC role (e.g., merchant, guard):');
    try {
      await api.createNPC(selectedCampaign.id, {
        name,
        description,
        role,
        campaign_id: selectedCampaign.id,
      });
      loadCampaignData();
    } catch (error) {
      console.error('Failed to create NPC:', error);
    }
  };

  const deleteNPC = async (id) => {
    if (!confirm('Delete this NPC?')) return;
    try {
      await api.deleteNPC(id);
      loadCampaignData();
    } catch (error) {
      console.error('Failed to delete NPC:', error);
    }
  };

  const createNode = async () => {
    if (!selectedCampaign) return;
    const title = prompt('Node title:');
    if (!title) return;
    const description = prompt('Node description (narrative text):');
    if (!description) return;
    try {
      await api.createNode(selectedCampaign.id, {
        title,
        description,
        campaign_id: selectedCampaign.id,
        node_type: 'story',
      });
      loadCampaignData();
    } catch (error) {
      console.error('Failed to create node:', error);
    }
  };

  const deleteNode = async (id) => {
    if (!confirm('Delete this node? This will also delete all choices!')) return;
    try {
      await api.deleteNode(id);
      loadCampaignData();
    } catch (error) {
      console.error('Failed to delete node:', error);
    }
  };

  const setStartNode = async (nodeId) => {
    if (!selectedCampaign) return;
    if (!confirm('Set this as the starting node for the campaign?')) return;
    try {
      await api.updateCampaign(selectedCampaign.id, { start_node_id: nodeId });
      loadCampaigns();
      alert('Start node updated!');
    } catch (error) {
      console.error('Failed to set start node:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">Campaign Editor</h1>
          <Link to="/" className="text-blue-400 hover:text-blue-300">
            ← Back to Home
          </Link>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {/* Campaigns Sidebar */}
          <div className="md:col-span-1 bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Campaigns</h2>
              <button
                onClick={createCampaign}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
              >
                + New
              </button>
            </div>
            <div className="space-y-2">
              {campaigns.map(campaign => (
                <div
                  key={campaign.id}
                  className={`p-3 rounded cursor-pointer transition ${
                    selectedCampaign?.id === campaign.id
                      ? 'bg-blue-600'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  onClick={() => setSelectedCampaign(campaign)}
                >
                  <div className="text-white font-semibold">{campaign.name}</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCampaign(campaign.id);
                    }}
                    className="text-red-400 hover:text-red-300 text-xs mt-1"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="md:col-span-3">
            {!selectedCampaign ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center">
                <p className="text-gray-400 text-xl">Select or create a campaign to start editing</p>
              </div>
            ) : (
              <>
                {/* Campaign Info */}
                <div className="bg-gray-800 rounded-lg p-6 mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedCampaign.name}</h2>
                  <p className="text-gray-300">{selectedCampaign.description || 'No description'}</p>
                  {selectedCampaign.start_node_id && (
                    <div className="mt-2 text-sm text-blue-400">
                      Start Node ID: {selectedCampaign.start_node_id}
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <div className="bg-gray-800 rounded-lg mb-6">
                  <div className="flex border-b border-gray-700">
                    {['locations', 'npcs', 'nodes'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-6 py-3 font-semibold transition ${
                          tab === t
                            ? 'text-white bg-gray-700'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>

                  <div className="p-6">
                    {/* Locations Tab */}
                    {tab === 'locations' && (
                      <>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xl font-bold text-white">Locations</h3>
                          <button
                            onClick={createLocation}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                          >
                            + Add Location
                          </button>
                        </div>
                        <div className="space-y-3">
                          {locations.map(loc => (
                            <div key={loc.id} className="bg-gray-700 p-4 rounded">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="text-white font-bold">{loc.name}</div>
                                  <div className="text-gray-400 text-sm">{loc.description}</div>
                                  <div className="text-gray-500 text-xs mt-1">ID: {loc.id}</div>
                                </div>
                                <button
                                  onClick={() => deleteLocation(loc.id)}
                                  className="text-red-400 hover:text-red-300 text-sm"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                          {locations.length === 0 && (
                            <p className="text-gray-500 text-center py-4">No locations yet</p>
                          )}
                        </div>
                      </>
                    )}

                    {/* NPCs Tab */}
                    {tab === 'npcs' && (
                      <>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xl font-bold text-white">NPCs</h3>
                          <button
                            onClick={createNPC}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                          >
                            + Add NPC
                          </button>
                        </div>
                        <div className="space-y-3">
                          {npcs.map(npc => (
                            <div key={npc.id} className="bg-gray-700 p-4 rounded">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="text-white font-bold">{npc.name}</div>
                                  <div className="text-gray-400 text-sm">{npc.description}</div>
                                  <div className="text-blue-400 text-xs mt-1">Role: {npc.role || 'None'}</div>
                                  <div className="text-gray-500 text-xs">ID: {npc.id}</div>
                                </div>
                                <button
                                  onClick={() => deleteNPC(npc.id)}
                                  className="text-red-400 hover:text-red-300 text-sm"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                          {npcs.length === 0 && (
                            <p className="text-gray-500 text-center py-4">No NPCs yet</p>
                          )}
                        </div>
                      </>
                    )}

                    {/* Nodes Tab */}
                    {tab === 'nodes' && (
                      <>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xl font-bold text-white">Narrative Nodes</h3>
                          <button
                            onClick={createNode}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                          >
                            + Add Node
                          </button>
                        </div>
                        <div className="space-y-3">
                          {nodes.map(node => (
                            <div key={node.id} className="bg-gray-700 p-4 rounded">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="text-white font-bold">{node.title}</div>
                                  <div className="text-gray-400 text-sm mt-1">
                                    {node.description.substring(0, 100)}...
                                  </div>
                                  <div className="flex gap-4 mt-2 text-xs">
                                    <span className="text-purple-400">Type: {node.node_type}</span>
                                    <span className="text-gray-500">ID: {node.id}</span>
                                    {node.is_ending && (
                                      <span className="text-red-400">ENDING</span>
                                    )}
                                  </div>
                                  <div className="text-gray-500 text-xs mt-1">
                                    Choices: {node.choices?.length || 0}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setStartNode(node.id)}
                                    className="text-green-400 hover:text-green-300 text-sm"
                                  >
                                    Set Start
                                  </button>
                                  <button
                                    onClick={() => deleteNode(node.id)}
                                    className="text-red-400 hover:text-red-300 text-sm"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {nodes.length === 0 && (
                            <p className="text-gray-500 text-center py-4">No nodes yet</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-gray-800/50 rounded-lg p-4 text-gray-400 text-sm">
                  <div className="font-bold text-white mb-2">Editor Guide:</div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Create locations for your world</li>
                    <li>Add NPCs with roles (merchant, guard, quest_giver, etc.)</li>
                    <li>Create narrative nodes (scenes/dialogues) - note the ID numbers</li>
                    <li>For advanced editing (choices, conditions), use the API directly or edit via database</li>
                    <li>Set a start node to make the campaign playable</li>
                    <li>The default campaign "The Shadow of Thornhaven" is fully playable!</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
