import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "outlined" | "warm";
  padding?: "none" | "sm" | "md" | "lg";
  children: React.ReactNode;
}

const variantClasses: Record<string, string> = {
  default: "bg-white border border-warm-200",
  elevated: "bg-white shadow-soft",
  outlined: "bg-transparent border-2 border-warm-200",
  warm: "bg-cream-100 border border-cream-300",
};

const paddingClasses: Record<string, string> = {
  none: "",
  sm: "p-3",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = "elevated",
      padding = "md",
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl transition-all duration-200",
          variantClasses[variant],
          paddingClasses[padding],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = "Card";

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn("flex items-center gap-3 mb-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export function CardTitle({ className, children, ...props }: CardTitleProps) {
  return (
    <h3
      className={cn("text-lg font-semibold text-warm-800", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardContent({
  className,
  children,
  ...props
}: CardContentProps) {
  return (
    <div className={cn("text-warm-600", className)} {...props}>
      {children}
    </div>
  );
}

export default Card;
