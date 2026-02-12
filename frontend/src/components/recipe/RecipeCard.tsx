import React, { useState } from "react";
import {
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  PlayCircle,
  Check,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParsedRecipe } from "@/lib/utils";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface RecipeCardProps {
  recipe: ParsedRecipe;
  onStartCooking?: (recipe: ParsedRecipe) => void;
}

export default function RecipeCard({
  recipe,
  onStartCooking,
}: RecipeCardProps) {
  const [showInstructions, setShowInstructions] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(
    new Set(),
  );

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const allChecked =
    recipe.ingredients.length > 0 &&
    checkedIngredients.size === recipe.ingredients.length;

  return (
    <Card
      variant="elevated"
      padding="none"
      className="overflow-hidden border border-warm-200"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-kitchly-orange/5 to-cream-200 px-5 py-4 border-b border-warm-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <UtensilsCrossed className="w-4 h-4 text-kitchly-orange" />
              <h3 className="text-lg font-bold text-warm-800 leading-tight">
                {recipe.title}
              </h3>
            </div>
            {recipe.cuisine && (
              <span className="inline-block px-2 py-0.5 bg-kitchly-orange/10 text-kitchly-orange text-xs font-medium rounded-full mt-1">
                {recipe.cuisine}
              </span>
            )}
          </div>
        </div>

        {/* Time and servings badges */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          {recipe.servings && (
            <div className="flex items-center gap-1.5 text-warm-500 text-sm">
              <Users className="w-3.5 h-3.5" />
              <span>
                {recipe.servings} serving{recipe.servings === "1" ? "" : "s"}
              </span>
            </div>
          )}
          {recipe.prepTime && (
            <div className="flex items-center gap-1.5 text-warm-500 text-sm">
              <Clock className="w-3.5 h-3.5" />
              <span>Prep: {recipe.prepTime}</span>
            </div>
          )}
          {recipe.cookTime && (
            <div className="flex items-center gap-1.5 text-warm-500 text-sm">
              <Clock className="w-3.5 h-3.5 text-kitchly-orange" />
              <span>Cook: {recipe.cookTime}</span>
            </div>
          )}
          {recipe.totalTime && (
            <div className="flex items-center gap-1.5 text-warm-500 text-sm">
              <Clock className="w-3.5 h-3.5" />
              <span>Total: {recipe.totalTime}</span>
            </div>
          )}
        </div>
      </div>

      {/* Ingredients */}
      {recipe.ingredients.length > 0 && (
        <div className="px-5 py-4">
          <h4 className="text-sm font-semibold text-warm-700 uppercase tracking-wide mb-3">
            Ingredients
          </h4>
          <ul className="space-y-2">
            {recipe.ingredients.map((ingredient, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <button
                  onClick={() => toggleIngredient(i)}
                  className={cn(
                    "flex-shrink-0 w-5 h-5 rounded-md border-2 mt-0.5",
                    "flex items-center justify-center",
                    "transition-all duration-200",
                    checkedIngredients.has(i)
                      ? "bg-kitchly-emerald border-kitchly-emerald"
                      : "border-warm-300 hover:border-kitchly-orange",
                  )}
                >
                  {checkedIngredients.has(i) && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </button>
                <span
                  className={cn(
                    "text-sm text-warm-600 leading-relaxed transition-all duration-200",
                    checkedIngredients.has(i) &&
                      "line-through text-warm-400",
                  )}
                >
                  {ingredient}
                </span>
              </li>
            ))}
          </ul>
          {allChecked && (
            <p className="mt-3 text-xs text-kitchly-emerald font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              All ingredients checked!
            </p>
          )}
        </div>
      )}

      {/* Instructions (collapsible) */}
      {recipe.instructions.length > 0 && (
        <div className="border-t border-warm-100">
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-warm-700 uppercase tracking-wide hover:bg-cream-100 transition-colors duration-200"
          >
            <span>Instructions ({recipe.instructions.length} steps)</span>
            {showInstructions ? (
              <ChevronUp className="w-4 h-4 text-warm-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-warm-400" />
            )}
          </button>

          {showInstructions && (
            <div className="px-5 pb-4 animate-fade-in">
              <ol className="space-y-3">
                {recipe.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-kitchly-orange/10 text-kitchly-orange text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-warm-600 leading-relaxed">
                      {step}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="px-5 py-4 bg-warm-50/50 border-t border-warm-100 flex flex-wrap gap-2.5">
        {/* Order Ingredients (Instacart) */}
        {recipe.instacartUrl ? (
          <a
            href={recipe.instacartUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[140px]"
          >
            <Button
              variant="emerald"
              size="md"
              className="w-full gap-2 text-sm font-semibold"
            >
              <ShoppingCart className="w-4 h-4" />
              Order Ingredients
            </Button>
          </a>
        ) : (
          <a
            href={`https://www.instacart.com/store/search/${encodeURIComponent(recipe.title)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[140px]"
          >
            <Button
              variant="emerald"
              size="md"
              className="w-full gap-2 text-sm font-semibold"
            >
              <ShoppingCart className="w-4 h-4" />
              Order Ingredients
            </Button>
          </a>
        )}

        {/* Cook Along */}
        {recipe.instructions.length > 0 && onStartCooking && (
          <Button
            variant="primary"
            size="md"
            className="flex-1 min-w-[140px] gap-2 text-sm font-semibold"
            onClick={() => onStartCooking(recipe)}
          >
            <PlayCircle className="w-4 h-4" />
            Cook Along
          </Button>
        )}
      </div>
    </Card>
  );
}
