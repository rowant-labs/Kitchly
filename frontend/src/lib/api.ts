const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface Agent {
  id: string;
  name: string;
  bio?: string;
  status?: string;
}

export interface MessagePayload {
  text: string;
  userId?: string;
  userName?: string;
}

export interface AgentResponse {
  text: string;
  action?: string;
  data?: Record<string, unknown>;
  attachments?: Array<{
    url: string;
    title?: string;
    description?: string;
    contentType?: string;
  }>;
}

function getUserId(): string {
  let userId = localStorage.getItem("kitchly_user_id");
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem("kitchly_user_id", userId);
  }
  return userId;
}

export async function sendMessage(
  agentId: string,
  text: string,
  file?: File,
): Promise<AgentResponse[]> {
  const userId = getUserId();

  if (file) {
    const formData = new FormData();
    formData.append("text", text);
    formData.append("userId", userId);
    formData.append("userName", "User");
    formData.append("file", file);

    const response = await fetch(`${BASE_URL}/${agentId}/message`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    return response.json();
  }

  const response = await fetch(`${BASE_URL}/${agentId}/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      userId,
      userName: "User",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }

  return response.json();
}

export async function getAgents(): Promise<{ agents: Agent[] }> {
  const response = await fetch(`${BASE_URL}/agents`);
  if (!response.ok) {
    throw new Error(`Failed to fetch agents: ${response.statusText}`);
  }
  return response.json();
}

export async function getAgent(agentId: string): Promise<Agent> {
  const response = await fetch(`${BASE_URL}/agents/${agentId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch agent: ${response.statusText}`);
  }
  return response.json();
}

export async function textToSpeech(
  agentId: string,
  text: string,
): Promise<Blob> {
  const response = await fetch(`${BASE_URL}/${agentId}/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`TTS failed: ${response.statusText}`);
  }

  return response.blob();
}

export async function speechToText(
  agentId: string,
  audioBlob: Blob,
): Promise<{ text: string }> {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");

  const response = await fetch(`${BASE_URL}/${agentId}/whisper`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`STT failed: ${response.statusText}`);
  }

  return response.json();
}
