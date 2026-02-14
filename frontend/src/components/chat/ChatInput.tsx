import React, { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (text: string, file?: File) => void;
  isLoading: boolean;
  disabled?: boolean;
  // TODO: Re-enable voice input when ElevenLabs integration is fixed
  // onStartListening: () => void;
  // onStopListening: () => void;
  // isListening: boolean;
  // isProcessing: boolean;
}

export default function ChatInput({
  onSendMessage,
  isLoading,
  disabled = false,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSend = () => {
    if ((!text.trim() && !attachedFile) || disabled || isLoading) return;
    onSendMessage(text.trim(), attachedFile || undefined);
    setText("");
    setAttachedFile(null);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const hasContent = text.trim().length > 0 || attachedFile;

  return (
    <div className="border-t border-warm-200 bg-white/80 backdrop-blur-lg pb-safe">
      {/* Attached file indicator */}
      {attachedFile && (
        <div className="px-4 pt-3 pb-0">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-cream-200 text-warm-600 text-xs rounded-lg">
            <Paperclip className="w-3 h-3" />
            <span className="max-w-[200px] truncate">{attachedFile.name}</span>
            <button
              onClick={handleRemoveFile}
              className="text-warm-400 hover:text-warm-600 ml-1"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 p-3 sm:p-4">
        {/* File attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex-shrink-0 p-2.5 rounded-xl text-warm-400 hover:text-warm-600 hover:bg-warm-100 transition-all duration-200 disabled:opacity-50"
          title="Attach image"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Text input area */}
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Kit anything about cooking..."
            disabled={disabled}
            rows={1}
            className={cn(
              "w-full bg-cream-100 border border-warm-200 rounded-2xl",
              "px-4 py-3 pr-12 text-[15px] text-warm-800",
              "placeholder:text-warm-400",
              "transition-all duration-200 ease-out",
              "focus:outline-none focus:ring-2 focus:ring-kitchly-orange/20 focus:border-kitchly-orange/50",
              "resize-none scrollbar-hidden",
              "disabled:opacity-50",
            )}
          />

          {/* Send button - inside the input */}
          {hasContent && (
            <button
              onClick={handleSend}
              disabled={disabled || isLoading || (!text.trim() && !attachedFile)}
              className={cn(
                "absolute right-2 bottom-2 p-2 rounded-xl",
                "bg-kitchly-orange text-white",
                "hover:bg-kitchly-orange-dark",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "animate-fade-in",
              )}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* TODO: Re-enable microphone button when ElevenLabs integration is fixed */}
      </div>
    </div>
  );
}
