/**
 * API Client for RPG Narrative Engine
 */

const API_BASE_URL = 'http://localhost:8000/api';

class ApiClient {
  // ============ Campaigns ============
  async getCampaigns() {
    const response = await fetch(`${API_BASE_URL}/campaigns`);
    return response.json();
  }

  async getCampaign(id) {
    const response = await fetch(`${API_BASE_URL}/campaigns/${id}`);
    return response.json();
  }

  async createCampaign(data) {
    const response = await fetch(`${API_BASE_URL}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async updateCampaign(id, data) {
    const response = await fetch(`${API_BASE_URL}/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async deleteCampaign(id) {
    const response = await fetch(`${API_BASE_URL}/campaigns/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  // ============ Locations ============
  async getLocations(campaignId) {
    const response = await fetch(`${API_BASE_URL}/campaigns/${campaignId}/locations`);
    return response.json();
  }

  async createLocation(campaignId, data) {
    const response = await fetch(`${API_BASE_URL}/campaigns/${campaignId}/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async updateLocation(id, data) {
    const response = await fetch(`${API_BASE_URL}/campaigns/locations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async deleteLocation(id) {
    const response = await fetch(`${API_BASE_URL}/campaigns/locations/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  // ============ NPCs ============
  async getNPCs(campaignId) {
    const response = await fetch(`${API_BASE_URL}/campaigns/${campaignId}/npcs`);
    return response.json();
  }

  async createNPC(campaignId, data) {
    const response = await fetch(`${API_BASE_URL}/campaigns/${campaignId}/npcs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async updateNPC(id, data) {
    const response = await fetch(`${API_BASE_URL}/campaigns/npcs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async deleteNPC(id) {
    const response = await fetch(`${API_BASE_URL}/campaigns/npcs/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  // ============ Narrative Nodes ============
  async getNodes(campaignId) {
    const response = await fetch(`${API_BASE_URL}/campaigns/${campaignId}/nodes`);
    return response.json();
  }

  async getNode(id) {
    const response = await fetch(`${API_BASE_URL}/campaigns/nodes/${id}`);
    return response.json();
  }

  async createNode(campaignId, data) {
    const response = await fetch(`${API_BASE_URL}/campaigns/${campaignId}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async updateNode(id, data) {
    const response = await fetch(`${API_BASE_URL}/campaigns/nodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async deleteNode(id) {
    const response = await fetch(`${API_BASE_URL}/campaigns/nodes/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  // ============ Choices ============
  async createChoice(nodeId, data) {
    const response = await fetch(`${API_BASE_URL}/campaigns/nodes/${nodeId}/choices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async updateChoice(id, data) {
    const response = await fetch(`${API_BASE_URL}/campaigns/choices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async deleteChoice(id) {
    const response = await fetch(`${API_BASE_URL}/campaigns/choices/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  // ============ Game Play ============
  async startGame(data) {
    const response = await fetch(`${API_BASE_URL}/game/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async getGameStates() {
    const response = await fetch(`${API_BASE_URL}/game/states`);
    return response.json();
  }

  async loadGame(gameStateId) {
    const response = await fetch(`${API_BASE_URL}/game/states/${gameStateId}`);
    return response.json();
  }

  async makeChoice(data) {
    const response = await fetch(`${API_BASE_URL}/game/choice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async deleteGameState(gameStateId) {
    const response = await fetch(`${API_BASE_URL}/game/states/${gameStateId}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  async saveGame(gameStateId) {
    const response = await fetch(`${API_BASE_URL}/game/save/${gameStateId}`, {
      method: 'POST',
    });
    return response.json();
  }
}

export default new ApiClient();
