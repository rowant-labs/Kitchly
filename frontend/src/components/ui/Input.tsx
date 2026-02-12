import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, icon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full bg-white border border-warm-200 rounded-xl",
            "px-4 py-2.5 text-warm-800 text-sm",
            "placeholder:text-warm-400",
            "transition-all duration-200 ease-out",
            "focus:outline-none focus:ring-2 focus:ring-kitchly-orange/30 focus:border-kitchly-orange",
            "hover:border-warm-300",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            icon && "pl-10",
            error && "border-red-400 focus:ring-red-300/30 focus:border-red-400",
            className,
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export default Input;
