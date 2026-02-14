import React, { useRef, useEffect, useState } from "react";
import {
  CalendarDays,
  Utensils,
  Drumstick,
  Flame,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChat, type ChatMessage as ChatMessageType } from "@/hooks/useChat";
import type { ParsedRecipe } from "@/lib/utils";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import CookingMode from "@/components/cooking/CookingMode";
import kitIcon from "@/assets/images/k.svg";

interface ChatViewProps {
  agentId: string;
}

const QUICK_SUGGESTIONS = [
  {
    icon: CalendarDays,
    label: "Plan my meals this week",
    message: "Can you help me plan my meals for this week?",
  },
  {
    icon: Utensils,
    label: "Quick weeknight dinner",
    message: "Suggest a quick and easy weeknight dinner recipe",
  },
  {
    icon: Drumstick,
    label: "Something with chicken",
    message: "What can I make with chicken for dinner tonight?",
  },
  {
    icon: Flame,
    label: "Give me 10 dinner ideas",
    message: "Give me 10 dinner ideas for this week",
  },
];

export default function ChatView({ agentId }: ChatViewProps) {
  const { messages, sendChatMessage, isLoading } = useChat({ agentId });
  const [cookingRecipe, setCookingRecipe] = useState<ParsedRecipe | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // TODO: Re-enable voice when ElevenLabs integration is fixed
  // const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  // const { isListening, isSpeaking, isProcessing, startListening, stopListening, speak, stopSpeaking } = useVoice({ agentId, onTranscript: handleTranscript });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSendMessage = (text: string, file?: File) => {
    sendChatMessage(text, file);
  };

  // TODO: Re-enable voice when ElevenLabs integration is fixed
  // const handleSpeak = (messageId: string, text: string) => {
  //   setSpeakingMessageId(messageId);
  //   speak(text).finally(() => setSpeakingMessageId(null));
  // };
  // const handleStopSpeaking = () => {
  //   stopSpeaking();
  //   setSpeakingMessageId(null);
  // };

  const handleStartCooking = (recipe: ParsedRecipe) => {
    setCookingRecipe(recipe);
  };

  const handleCloseCooking = () => {
    setCookingRecipe(null);
  };

  const handleSuggestionClick = (message: string) => {
    sendChatMessage(message);
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Messages area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 scrollbar-hidden"
        >
          {isEmpty ? (
            <EmptyState onSuggestionClick={handleSuggestionClick} />
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onStartCooking={handleStartCooking}
                />
              ))}

              {/* Loading indicator — hidden when a streaming message is already visible */}
              {isLoading &&
                !messages.some((m) => m.isStreaming) && <TypingIndicator />}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 max-w-3xl mx-auto w-full">
          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Cooking Mode Overlay */}
      {cookingRecipe && (
        <CookingMode
          recipe={cookingRecipe}
          agentId={agentId}
          onClose={handleCloseCooking}
        />
      )}
    </>
  );
}

function EmptyState({
  onSuggestionClick,
}: {
  onSuggestionClick: (message: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto px-4 py-8">
      {/* Avatar */}
      <div className="w-16 h-16 rounded-2xl bg-white border border-warm-200 flex items-center justify-center shadow-soft mb-6 animate-bounce-subtle overflow-hidden">
        <img src={kitIcon} alt="Kit" className="w-10 h-10" />
      </div>

      {/* Welcome text */}
      <h2 className="text-2xl font-bold text-warm-800 text-center mb-2">
        Hey! I'm Kit
      </h2>
      <p className="text-warm-500 text-center text-[15px] mb-4 leading-relaxed">
        Your meal planning sidekick. Ask me for recipe ideas, weekly meal plans,
        or help figuring out what to cook tonight!
      </p>

      {/* Instacart CTA */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-50 border border-orange-100 mb-8">
        <ShoppingCart className="w-4 h-4 text-kitchly-orange flex-shrink-0" />
        <p className="text-sm font-semibold text-warm-700">
          Order ingredients from any recipe or meal plan with one tap to Instacart.
        </p>
      </div>

      {/* Suggestion chips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
        {QUICK_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.label}
            onClick={() => onSuggestionClick(suggestion.message)}
            className={cn(
              "flex items-center gap-3 p-3.5 rounded-2xl",
              "bg-white border border-warm-200",
              "text-left text-sm text-warm-600",
              "hover:border-kitchly-orange/30 hover:bg-cream-100 hover:shadow-soft",
              "transition-all duration-200 ease-out",
              "active:scale-[0.98]",
              "group",
            )}
          >
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-cream-200 flex items-center justify-center group-hover:bg-orange-100 transition-colors duration-200">
              <suggestion.icon className="w-4.5 h-4.5 text-warm-500 group-hover:text-kitchly-orange transition-colors duration-200" />
            </div>
            <span className="font-medium group-hover:text-warm-800 transition-colors duration-200">
              {suggestion.label}
            </span>
          </button>
        ))}
      </div>

      {/* TODO: Re-enable voice hint when ElevenLabs integration is fixed */}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border border-warm-200 flex items-center justify-center shadow-soft overflow-hidden">
        <img src={kitIcon} alt="Kit" className="w-5 h-5" />
      </div>
      <div className="bg-white border border-warm-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-soft">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-warm-400 typing-dot" />
          <div className="w-2 h-2 rounded-full bg-warm-400 typing-dot" />
          <div className="w-2 h-2 rounded-full bg-warm-400 typing-dot" />
        </div>
      </div>
    </div>
  );
}
