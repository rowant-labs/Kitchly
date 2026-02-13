import { useState, useCallback, useRef } from "react";
import { sendMessageStream, sendMessage, type AgentResponse } from "@/lib/api";
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
  isStreaming?: boolean;
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
  const streamingIdRef = useRef<string | null>(null);

  const sendChatMessage = useCallback(
    async (text: string, file?: File) => {
      if (!text.trim() && !file) return;

      setError(null);

      // Cancel any in-flight request
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Add user message
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      // Create a placeholder streaming message
      const streamingId = generateMessageId();
      streamingIdRef.current = streamingId;

      const streamingMessage: ChatMessage = {
        id: streamingId,
        role: "agent",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, streamingMessage]);
      setIsLoading(true);

      try {
        let streamedText = "";

        const responses = await sendMessageStream(
          agentId,
          text.trim(),
          (chunk) => {
            streamedText += chunk;
            // Update the streaming message in-place
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingId
                  ? { ...msg, content: streamedText }
                  : msg,
              ),
            );
          },
          abortController.signal,
        );

        // Finalize: replace streaming message with final parsed version
        const finalText = responses[0]?.text || streamedText || "";
        const recipe = parseRecipeFromText(finalText);
        const instacartLinks = extractInstacartLinks(finalText);

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === streamingId
              ? {
                  ...msg,
                  content: finalText,
                  isStreaming: false,
                  recipe: recipe || undefined,
                  instacartLinks:
                    instacartLinks.length > 0 ? instacartLinks : undefined,
                }
              : msg,
          ),
        );

        streamingIdRef.current = null;
      } catch (err) {
        if (abortController.signal.aborted) return;

        const message =
          err instanceof Error ? err.message : "Failed to send message";
        setError(message);
        console.error("Chat error:", err);

        // Replace streaming placeholder with error message
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === streamingId
              ? {
                  ...msg,
                  content:
                    "Sorry, I'm having trouble connecting right now. Please try again in a moment!",
                  isStreaming: false,
                }
              : msg,
          ),
        );

        streamingIdRef.current = null;
      } finally {
        setIsLoading(false);
      }
    },
    [agentId],
  );

  const clearMessages = useCallback(() => {
    abortControllerRef.current?.abort();
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
