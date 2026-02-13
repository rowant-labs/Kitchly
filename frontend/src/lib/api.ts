const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const MESSAGE_SERVER_ID = "00000000-0000-0000-0000-000000000000";

export interface Agent {
  id: string;
  name: string;
  characterName?: string;
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

/** Generate a UUID v4. */
function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Get or create a persistent user ID (UUID) for this browser session. */
function getUserId(): string {
  let userId = localStorage.getItem("kitchly_user_id");
  if (!userId || userId.length < 36) {
    userId = uuid();
    localStorage.setItem("kitchly_user_id", userId);
  }
  return userId;
}

/** Get or create a persistent channel ID for chatting with a specific agent. */
function getChannelId(agentId: string): string {
  const key = `kitchly_channel_${agentId}`;
  let channelId = localStorage.getItem(key);
  if (!channelId || channelId.length < 36) {
    channelId = uuid();
    localStorage.setItem(key, channelId);
  }
  return channelId;
}

/**
 * Send a message to an agent via the ElizaOS channel messaging API.
 * Then poll for the agent's response.
 */
export async function sendMessage(
  agentId: string,
  text: string,
  _file?: File,
): Promise<AgentResponse[]> {
  const userId = getUserId();
  const channelId = getChannelId(agentId);

  // Send the user message
  const sendResponse = await fetch(
    `${BASE_URL}/api/messaging/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author_id: userId,
        content: text,
        message_server_id: MESSAGE_SERVER_ID,
        source_type: "direct",
        metadata: {
          isDm: true,
          targetUserId: agentId,
        },
      }),
    },
  );

  if (!sendResponse.ok) {
    throw new Error(`Failed to send message: ${sendResponse.statusText}`);
  }

  const sendData = await sendResponse.json();
  const userMessageId = sendData.userMessage?.id;

  // Poll for the agent's response
  const maxAttempts = 30;
  const pollInterval = 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const messagesResponse = await fetch(
      `${BASE_URL}/api/messaging/channels/${channelId}/messages`,
    );

    if (!messagesResponse.ok) continue;

    const messagesData = await messagesResponse.json();
    const messages = messagesData.data?.messages || [];

    // Find agent responses to our message
    const agentResponses = messages.filter(
      (msg: Record<string, unknown>) =>
        msg.authorId === agentId &&
        msg.inReplyToRootMessageId === userMessageId,
    );

    if (agentResponses.length > 0) {
      return agentResponses.map(
        (msg: Record<string, string>) =>
          ({
            text: msg.content || "",
          }) as AgentResponse,
      );
    }
  }

  // Timeout — no response received
  return [{ text: "I'm taking a bit longer than usual. Please try again." }];
}

export async function getAgents(): Promise<{ agents: Agent[] }> {
  const response = await fetch(`${BASE_URL}/api/agents`);
  if (!response.ok) {
    throw new Error(`Failed to fetch agents: ${response.statusText}`);
  }
  const data = await response.json();
  // ElizaOS wraps in { success, data: { agents } }
  return { agents: data.data?.agents || data.agents || [] };
}

export async function getAgent(agentId: string): Promise<Agent> {
  const response = await fetch(`${BASE_URL}/api/agents/${agentId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch agent: ${response.statusText}`);
  }
  const data = await response.json();
  return data.data || data;
}

export async function textToSpeech(
  agentId: string,
  text: string,
): Promise<Blob> {
  const response = await fetch(`${BASE_URL}/api/agents/${agentId}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`TTS failed: ${response.statusText}`);
  }

  return response.blob();
}

export async function speechToText(
  _agentId: string,
  audioBlob: Blob,
): Promise<{ text: string }> {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");

  const response = await fetch(`${BASE_URL}/api/agents/whisper`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`STT failed: ${response.statusText}`);
  }

  return response.json();
}
