import React from "react";
import kitchlyWordmark from "@/assets/images/kitchly-wordmark.svg";

export default function Header() {
  return (
    <header className="flex-shrink-0 bg-white/80 backdrop-blur-lg border-b border-warm-200 px-4 sm:px-6 pt-safe">
      <div className="max-w-3xl mx-auto flex items-center justify-between h-14">
        {/* Logo */}
        <div className="flex items-center">
          <img
            src={kitchlyWordmark}
            alt="Kitchly"
            className="h-7"
          />
        </div>

        {/* Kit status */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-cream-100 rounded-full">
          <div className="w-2 h-2 rounded-full bg-kitchly-emerald animate-pulse" />
          <span className="text-xs font-medium text-warm-600">
            Kit is online
          </span>
        </div>
      </div>
    </header>
  );
}
