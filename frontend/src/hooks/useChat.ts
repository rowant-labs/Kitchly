import { useState, useCallback, useRef } from "react";
import { sendMessage, type AgentResponse } from "@/lib/api";
import {
  generateMessageId,
  parseRecipeFromText,
  extractInstacartLinks,
  type ParsedRecipe,
} from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  recipe?: ParsedRecipe;
  instacartLinks?: string[];
  attachments?: AgentResponse["attachments"];
}

interface UseChatOptions {
  agentId: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  sendChatMessage: (text: string, file?: File) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearMessages: () => void;
  agentId: string;
}

export function useChat({ agentId }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendChatMessage = useCallback(
    async (text: string, file?: File) => {
      if (!text.trim() && !file) return;

      setError(null);

      // Add user message
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const responses = await sendMessage(agentId, text.trim(), file);

        // Process each response from the agent
        const agentMessages: ChatMessage[] = responses.map((resp) => {
          const responseText = resp.text || "";
          const recipe = parseRecipeFromText(responseText);
          const instacartLinks = extractInstacartLinks(responseText);

          return {
            id: generateMessageId(),
            role: "agent" as const,
            content: responseText,
            timestamp: new Date(),
            recipe: recipe || undefined,
            instacartLinks:
              instacartLinks.length > 0 ? instacartLinks : undefined,
            attachments: resp.attachments,
          };
        });

        if (agentMessages.length === 0) {
          // If no response text, add a fallback
          agentMessages.push({
            id: generateMessageId(),
            role: "agent",
            content:
              "I'm here to help! Could you tell me more about what you'd like to cook?",
            timestamp: new Date(),
          });
        }

        setMessages((prev) => [...prev, ...agentMessages]);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to send message";
        setError(message);
        console.error("Chat error:", err);

        // Add error message from agent
        setMessages((prev) => [
          ...prev,
          {
            id: generateMessageId(),
            role: "agent",
            content:
              "Sorry, I'm having trouble connecting right now. Please try again in a moment!",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [agentId],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    sendChatMessage,
    isLoading,
    error,
    clearMessages,
    agentId,
  };
}
