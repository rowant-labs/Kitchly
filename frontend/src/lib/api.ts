const BASE_URL = import.meta.env.VITE_API_URL || "";
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
 * Send a message via SSE transport for streaming responses.
 * The POST response itself is an event stream.
 */
export async function sendMessageStream(
  agentId: string,
  text: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<AgentResponse[]> {
  const userId = getUserId();
  const channelId = getChannelId(agentId);

  const response = await fetch(
    `${BASE_URL}/api/messaging/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author_id: userId,
        content: text,
        message_server_id: MESSAGE_SERVER_ID,
        source_type: "direct",
        transport: "sse",
        metadata: {
          isDm: true,
          targetUserId: agentId,
        },
      }),
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";

  // If server didn't return SSE, fall back to JSON
  if (!contentType.includes("text/event-stream")) {
    const data = await response.json();
    // HTTP transport puts response in agentResponse; websocket transport has no response inline
    const agentText =
      data.agentResponse?.text ||
      data.agentResponse?.content?.text ||
      data.text ||
      "";
    if (agentText) {
      onChunk(agentText);
      return [{ text: agentText }];
    }
    // Websocket transport — no inline response; return empty so useChat shows error
    console.warn("[sendMessageStream] Server returned JSON instead of SSE. Transport may not be supported.", data);
    return [{ text: "" }];
  }

  // Parse SSE event stream
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  const finalResponses: AgentResponse[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events from buffer (format: "event: type\ndata: {...}\n\n")
    const events = buffer.split("\n\n");
    buffer = events.pop() || ""; // Keep incomplete event in buffer

    for (const event of events) {
      if (!event.trim()) continue;

      let eventType = "";
      let eventData = "";

      for (const line of event.split("\n")) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          eventData = line.slice(6);
        }
      }

      if (!eventData) continue;

      try {
        const parsed = JSON.parse(eventData);

        switch (eventType) {
          case "chunk": {
            const chunk = parsed.chunk || "";
            if (chunk) {
              fullText += chunk;
              onChunk(chunk);
            }
            break;
          }
          case "done": {
            const doneText = parsed.text || parsed.content?.text || fullText;
            // If no chunks were streamed, simulate typing word-by-word
            if (!fullText && doneText) {
              const words = doneText.split(/(\s+)/);
              for (const word of words) {
                fullText += word;
                onChunk(word);
                await new Promise((r) => setTimeout(r, 12));
              }
            }
            finalResponses.push({ text: doneText });
            break;
          }
          case "error": {
            throw new Error(parsed.error || "Stream error");
          }
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue; // Skip unparseable data
        throw e;
      }
    }
  }

  // If we got chunks but no "done" event, use accumulated text
  if (finalResponses.length === 0 && fullText) {
    finalResponses.push({ text: fullText });
  }

  return finalResponses;
}

/**
 * Send a message to an agent via the ElizaOS channel messaging API.
 * Then poll for the agent's response. (Non-streaming fallback)
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
