import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export interface ParsedRecipe {
  title: string;
  cuisine?: string;
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  ingredients: string[];
  instructions: string[];
  instacartUrl?: string;
  notes?: string;
}

export function parseRecipeFromText(text: string): ParsedRecipe | null {
  // Look for structured recipe patterns
  const hasTitle =
    /^#+\s*.+/m.test(text) || /\*\*Recipe:\s*.+\*\*/i.test(text);
  const hasIngredients =
    /ingredients/i.test(text) &&
    (text.includes("- ") || text.includes("* ") || /\d+\s*(cup|tbsp|tsp|oz|lb|g|kg|ml|l|clove|piece|bunch|can|package)/i.test(text));
  const hasInstructions = /instructions|directions|steps|method/i.test(text);

  if (!hasIngredients && !hasInstructions) return null;
  if (!hasTitle && !hasIngredients) return null;

  // Extract title
  let title = "Recipe";
  const titleMatch =
    text.match(/^#+\s*(.+)/m) ||
    text.match(/\*\*Recipe:\s*(.+?)\*\*/i) ||
    text.match(/\*\*(.+?)\*\*/);
  if (titleMatch) {
    title = titleMatch[1].replace(/\*+/g, "").trim();
  }

  // Extract cuisine
  let cuisine: string | undefined;
  const cuisineMatch = text.match(
    /cuisine:\s*(.+)/i,
  );
  if (cuisineMatch) cuisine = cuisineMatch[1].trim();

  // Extract servings
  let servings: string | undefined;
  const servingsMatch = text.match(
    /serves?:?\s*(\d+[-\s]?\d*)/i,
  ) || text.match(/servings?:?\s*(\d+[-\s]?\d*)/i) || text.match(/yield:?\s*(\d+[-\s]?\d*)/i);
  if (servingsMatch) servings = servingsMatch[1].trim();

  // Extract prep time
  let prepTime: string | undefined;
  const prepMatch = text.match(
    /prep(?:\s*time)?:?\s*([\d]+\s*(?:min(?:utes?)?|hr|hours?)?)/i,
  );
  if (prepMatch) prepTime = prepMatch[1].trim();

  // Extract cook time
  let cookTime: string | undefined;
  const cookMatch = text.match(
    /cook(?:\s*time)?:?\s*([\d]+\s*(?:min(?:utes?)?|hr|hours?)?)/i,
  );
  if (cookMatch) cookTime = cookMatch[1].trim();

  // Extract total time
  let totalTime: string | undefined;
  const totalMatch = text.match(
    /total(?:\s*time)?:?\s*([\d]+\s*(?:min(?:utes?)?|hr|hours?)?)/i,
  );
  if (totalMatch) totalTime = totalMatch[1].trim();

  // Extract ingredients
  const ingredients: string[] = [];
  const ingredientSection = text.match(
    /ingredients[:\s]*\n([\s\S]*?)(?=\n(?:instructions|directions|steps|method|notes|\*\*)|$)/i,
  );
  if (ingredientSection) {
    const lines = ingredientSection[1].split("\n");
    for (const line of lines) {
      const cleaned = line.replace(/^[\s\-\*\d.]+/, "").trim();
      if (cleaned && cleaned.length > 1 && !cleaned.match(/^#+/)) {
        ingredients.push(cleaned);
      }
    }
  }

  // Extract instructions
  const instructions: string[] = [];
  const instructionSection = text.match(
    /(?:instructions|directions|steps|method)[:\s]*\n([\s\S]*?)(?=\n(?:notes|tips|\*\*)|$)/i,
  );
  if (instructionSection) {
    const lines = instructionSection[1].split("\n");
    for (const line of lines) {
      const cleaned = line.replace(/^[\s\-\*\d.)+]+/, "").trim();
      if (cleaned && cleaned.length > 5) {
        instructions.push(cleaned);
      }
    }
  }

  // Extract Instacart URL
  let instacartUrl: string | undefined;
  const instacartMatch = text.match(
    /https?:\/\/(?:www\.)?instacart\.com[^\s\])]+/,
  );
  if (instacartMatch) instacartUrl = instacartMatch[0];

  // Only return if we got meaningful content
  if (ingredients.length === 0 && instructions.length === 0) return null;

  return {
    title,
    cuisine,
    servings,
    prepTime,
    cookTime,
    totalTime,
    ingredients,
    instructions,
    instacartUrl,
  };
}

export function extractInstacartLinks(text: string): string[] {
  const matches = text.match(
    /https?:\/\/(?:www\.)?instacart\.com[^\s\])]+/g,
  );
  return matches || [];
}

export function renderSimpleMarkdown(text: string): string {
  let html = text;

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Links (but not already HTML)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-kitchly-orange hover:text-kitchly-orange-dark underline underline-offset-2">$1</a>',
  );

  // Line breaks
  html = html.replace(/\n/g, "<br />");

  return html;
}
