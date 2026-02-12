import React, { useState } from "react";
import { Settings, ChefHat, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onClearChat?: () => void;
}

export default function Header({ onClearChat }: HeaderProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="flex-shrink-0 bg-white/80 backdrop-blur-lg border-b border-warm-200 px-4 sm:px-6 pt-safe">
        <div className="max-w-3xl mx-auto flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-kitchly-orange to-kitchly-orange-dark flex items-center justify-center shadow-warm">
              <ChefHat className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold text-warm-800 tracking-tight">
              Kitchly
            </span>
          </div>

          {/* Agent status + Settings */}
          <div className="flex items-center gap-3">
            {/* Kit status */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-cream-100 rounded-full">
              <div className="w-2 h-2 rounded-full bg-kitchly-emerald animate-pulse" />
              <span className="text-xs font-medium text-warm-600">
                Kit is online
              </span>
            </div>

            {/* Settings */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-xl text-warm-400 hover:text-warm-600 hover:bg-warm-100 transition-all duration-200"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Settings dropdown */}
      {showSettings && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowSettings(false)}
          />

          {/* Panel */}
          <div className="absolute right-4 sm:right-6 top-16 z-50 animate-slide-up">
            <div className="bg-white rounded-2xl shadow-soft border border-warm-200 overflow-hidden min-w-[220px]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-warm-100">
                <span className="text-sm font-semibold text-warm-700">
                  Settings
                </span>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1 rounded-lg text-warm-400 hover:text-warm-600 hover:bg-warm-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-2">
                {onClearChat && (
                  <button
                    onClick={() => {
                      onClearChat();
                      setShowSettings(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl",
                      "text-sm text-warm-600 hover:text-red-600",
                      "hover:bg-red-50 transition-all duration-200",
                    )}
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear conversation
                  </button>
                )}

                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-sm text-warm-600">API</span>
                  <span className="text-xs text-warm-400 font-mono bg-warm-100 px-2 py-0.5 rounded">
                    {import.meta.env.VITE_API_URL || "localhost:3000"}
                  </span>
                </div>

                <div className="px-3 py-2.5 border-t border-warm-100 mt-1">
                  <p className="text-[10px] text-warm-400 text-center">
                    Kitchly v0.1.0 &middot; Powered by ElizaOS
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
