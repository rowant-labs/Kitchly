import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "emerald";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-kitchly-orange text-white hover:bg-kitchly-orange-dark active:bg-orange-700 shadow-warm hover:shadow-lg",
  secondary:
    "bg-warm-100 text-warm-700 hover:bg-warm-200 active:bg-warm-300",
  ghost:
    "bg-transparent text-warm-600 hover:bg-warm-100 active:bg-warm-200",
  outline:
    "bg-transparent border-2 border-warm-300 text-warm-700 hover:border-kitchly-orange hover:text-kitchly-orange active:bg-cream-200",
  emerald:
    "bg-kitchly-emerald text-white hover:bg-kitchly-emerald-dark active:bg-emerald-700 shadow-md hover:shadow-lg",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-4 py-2.5 text-sm rounded-xl",
  lg: "px-6 py-3 text-base rounded-xl",
  icon: "p-2.5 rounded-xl",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      className,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 ease-out",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-kitchly-orange focus-visible:ring-offset-2 focus-visible:ring-offset-cream-100",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
          "select-none whitespace-nowrap",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
