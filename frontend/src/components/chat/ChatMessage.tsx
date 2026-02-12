import React, { useState, useMemo } from "react";
import {
  Volume2,
  VolumeX,
  Copy,
  Check,
  ShoppingCart,
  ChefHat,
} from "lucide-react";
import { cn, renderSimpleMarkdown, extractInstacartLinks } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/hooks/useChat";
import type { ParsedRecipe } from "@/lib/utils";
import Button from "@/components/ui/Button";
import RecipeCard from "@/components/recipe/RecipeCard";

interface ChatMessageProps {
  message: ChatMessageType;
  onSpeak?: (text: string) => void;
  isSpeaking?: boolean;
  onStopSpeaking?: () => void;
  onStartCooking?: (recipe: ParsedRecipe) => void;
}

export default function ChatMessage({
  message,
  onSpeak,
  isSpeaking,
  onStopSpeaking,
  onStartCooking,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = message.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSpeak = () => {
    if (isSpeaking) {
      onStopSpeaking?.();
    } else {
      // Strip markdown for TTS
      const plainText = message.content
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/#{1,6}\s/g, "")
        .replace(/[-*]\s/g, "")
        .replace(/\d+\.\s/g, "");
      onSpeak?.(plainText);
    }
  };

  // Extract Instacart links that aren't part of a recipe
  const standaloneInstacartLinks = useMemo(() => {
    if (message.recipe) return []; // Recipe card handles its own links
    return extractInstacartLinks(message.content);
  }, [message.content, message.recipe]);

  // Render content without the recipe portion if a recipe was parsed
  const renderedContent = useMemo(() => {
    if (isUser) return message.content;

    let content = message.content;

    // If there's a recipe, we'll show the recipe card separately,
    // but still show any preamble text before the recipe
    if (message.recipe) {
      // Try to extract text before the recipe starts
      const recipeStartPatterns = [
        /(?=#+\s)/m,
        /(?=\*\*Recipe:)/i,
        /(?=\*\*Ingredients)/i,
      ];

      for (const pattern of recipeStartPatterns) {
        const match = content.search(pattern);
        if (match > 0) {
          content = content.substring(0, match).trim();
          break;
        } else if (match === 0) {
          content = "";
          break;
        }
      }
    }

    // Remove Instacart links from inline text (we render them as buttons)
    if (standaloneInstacartLinks.length > 0) {
      for (const link of standaloneInstacartLinks) {
        content = content.replace(
          new RegExp(`\\[([^\\]]+)\\]\\(${link.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`, "g"),
          "",
        );
        content = content.replace(link, "");
      }
    }

    return content.trim();
  }, [message.content, message.recipe, isUser, standaloneInstacartLinks]);

  return (
    <div
      className={cn(
        "flex gap-3 animate-slide-up",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-kitchly-orange to-kitchly-orange-dark flex items-center justify-center shadow-warm mt-1">
          <ChefHat className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Message bubble */}
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[75%]",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-[15px] leading-relaxed",
            isUser
              ? "bg-kitchly-orange text-white rounded-br-md"
              : "bg-white border border-warm-200 text-warm-700 rounded-bl-md shadow-soft",
          )}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <>
              {renderedContent && (
                <div
                  className="prose-sm"
                  dangerouslySetInnerHTML={{
                    __html: renderSimpleMarkdown(renderedContent),
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* Recipe Card */}
        {message.recipe && (
          <div className="mt-3 animate-bounce-subtle">
            <RecipeCard
              recipe={message.recipe}
              onStartCooking={onStartCooking}
            />
          </div>
        )}

        {/* Standalone Instacart Links */}
        {standaloneInstacartLinks.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {standaloneInstacartLinks.map((link, i) => (
              <a
                key={i}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-kitchly-emerald text-white text-sm font-medium rounded-xl hover:bg-kitchly-emerald-dark transition-colors shadow-md hover:shadow-lg"
              >
                <ShoppingCart className="w-4 h-4" />
                Order on Instacart
              </a>
            ))}
          </div>
        )}

        {/* Action buttons for agent messages */}
        {!isUser && (
          <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity duration-200"
               style={{ opacity: 1 }}
          >
            {onSpeak && (
              <button
                onClick={handleSpeak}
                className={cn(
                  "p-1.5 rounded-lg text-warm-400 hover:text-kitchly-orange hover:bg-cream-200 transition-all duration-200",
                  isSpeaking && "text-kitchly-orange bg-cream-200",
                )}
                title={isSpeaking ? "Stop speaking" : "Read aloud"}
              >
                {isSpeaking ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-warm-400 hover:text-kitchly-orange hover:bg-cream-200 transition-all duration-200"
              title="Copy message"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-kitchly-emerald" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
