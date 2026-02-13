import React from "react";

/**
 * Instacart Carrot SVG logo — official brand asset.
 * Colors: green top (#0AAD0A), orange bottom (#FF7009).
 */
function InstacartCarrot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 42.3 52.9"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="#0AAD0A"
        d="M36.4,8.6c-2.3,0-4,1-5.5,3.2l-4.4,6.4V0H15.9v18.2l-4.4-6.4C9.9,9.6,8.2,8.6,5.9,8.6C2.4,8.6,0,11.2,0,14.4c0,2.7,1.3,4.5,4,6.3l17.1,11l17.1-11c2.7-1.8,4-3.5,4-6.3C42.3,11.2,39.9,8.6,36.4,8.6z"
      />
      <path
        fill="#FF7009"
        d="M21.1,34.4c10.2,0,18.5,7.6,18.5,18.5h-37C2.6,42,11,34.4,21.1,34.4z"
      />
    </svg>
  );
}

interface InstacartButtonProps {
  href: string;
  label?: string;
  className?: string;
}

/**
 * Branded Instacart button matching official IDP guidelines.
 * Dark green (#003D29) background, cream (#FAF1E5) text,
 * pill-shaped with Instacart carrot logo.
 */
export default function InstacartButton({
  href,
  label = "Order ingredients",
  className = "",
}: InstacartButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-full font-semibold text-sm transition-opacity duration-200 hover:opacity-90 ${className}`}
      style={{
        backgroundColor: "#003D29",
        color: "#FAF1E5",
        height: "46px",
        paddingLeft: "18px",
        paddingRight: "18px",
      }}
    >
      <InstacartCarrot className="w-[22px] h-[22px] flex-shrink-0" />
      {label}
    </a>
  );
}
