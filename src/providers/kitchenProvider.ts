import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
} from '@elizaos/core';
import type { KitchenState } from '../types/index.js';

/** Build a deterministic cache key for a room's kitchen state. */
const getCacheKey = (roomId: string): string => `kitchen_state_${roomId}`;

/**
 * kitchenProvider -- surfaces the current kitchen state (active recipe,
 * meal plan, cooking session, user preferences) to the LLM on every turn
 * so that it can craft contextually-aware responses.
 */
export const kitchenProvider: Provider = {
  name: 'KITCHEN_STATE',
  description:
    'Provides current kitchen state including active recipe, meal plan, and cooking session',
  dynamic: true,
  position: 50,

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
  ): Promise<{ text: string; values: Record<string, any>; data: Record<string, any> }> => {
    const roomId = message.roomId;
    const cacheKey = getCacheKey(roomId);

    let kitchenState: KitchenState = {};
    try {
      const cached = await runtime.cacheManager?.get(cacheKey);
      if (cached && typeof cached === 'object') {
        kitchenState = cached as KitchenState;
      }
    } catch {
      // Cache miss or error -- start with an empty state
    }

    // ---- Build human-readable text for the LLM context ----
    const sections: string[] = [];

    // Active recipe
    if (kitchenState.currentRecipe) {
      const r = kitchenState.currentRecipe;
      const ingredientList = r.ingredients
        .map((ing) => {
          const meas = ing.measurements
            ?.map((m) => `${m.quantity} ${m.unit}`)
            .join(', ');
          return meas ? `  - ${ing.name} (${meas})` : `  - ${ing.name}`;
        })
        .join('\n');
      sections.push(
        `[Active Recipe]\nTitle: ${r.title}` +
          (r.servings ? `\nServings: ${r.servings}` : '') +
          (r.prepTime ? `\nPrep time: ${r.prepTime}` : '') +
          (r.cookTime ? `\nCook time: ${r.cookTime}` : '') +
          `\nIngredients:\n${ingredientList}` +
          `\nSteps: ${r.instructions.length} total`,
      );
    }

    // Instacart link
    if (kitchenState.productsLinkUrl) {
      sections.push(
        `[Instacart Link]\n${kitchenState.productsLinkUrl}`,
      );
    }

    // Active meal plan
    if (kitchenState.currentMealPlan) {
      const mp = kitchenState.currentMealPlan;
      const daysSummary = mp.days
        .map((d) => {
          const meals = d.meals.map((m) => `${m.type}: ${m.recipe}`).join(', ');
          return `  ${d.day}: ${meals}`;
        })
        .join('\n');
      sections.push(
        `[Active Meal Plan]\nTitle: ${mp.title}\n${daysSummary}` +
          `\nConsolidated shopping list items: ${mp.consolidatedList.length}`,
      );
    }

    // Cooking session
    if (kitchenState.cookingSession) {
      const cs = kitchenState.cookingSession;
      const total = cs.recipe.instructions.length;
      sections.push(
        `[Cooking Session]\nRecipe: ${cs.recipe.title}` +
          `\nCurrent step: ${cs.currentStep + 1} of ${total}` +
          `\nStatus: ${cs.isPaused ? 'paused' : 'active'}`,
      );
    }

    // User preferences
    if (kitchenState.userPreferences) {
      const up = kitchenState.userPreferences;
      const prefs: string[] = [];
      if (up.dietaryRestrictions?.length)
        prefs.push(`Dietary restrictions: ${up.dietaryRestrictions.join(', ')}`);
      if (up.allergies?.length)
        prefs.push(`Allergies: ${up.allergies.join(', ')}`);
      if (up.cuisinePreferences?.length)
        prefs.push(`Cuisine preferences: ${up.cuisinePreferences.join(', ')}`);
      if (up.servingSize) prefs.push(`Preferred servings: ${up.servingSize}`);
      if (up.budget) prefs.push(`Budget: ${up.budget}`);
      if (up.cookingSkill) prefs.push(`Skill level: ${up.cookingSkill}`);
      if (prefs.length) {
        sections.push(`[User Preferences]\n${prefs.join('\n')}`);
      }
    }

    const text =
      sections.length > 0
        ? `Current Kitchen State:\n${sections.join('\n\n')}`
        : 'No active kitchen session. The user has not started a recipe, meal plan, or cooking session yet.';

    return {
      text,
      values: {
        hasActiveRecipe: !!kitchenState.currentRecipe,
        hasActiveMealPlan: !!kitchenState.currentMealPlan,
        hasCookingSession: !!kitchenState.cookingSession,
        currentStep: kitchenState.cookingSession?.currentStep ?? -1,
        totalSteps:
          kitchenState.cookingSession?.recipe.instructions.length ?? 0,
      },
      data: kitchenState as Record<string, any>,
    };
  },
};

// ---------------------------------------------------------------------------
// Helpers to read / update kitchen state from cache
// ---------------------------------------------------------------------------

/**
 * Retrieve the current kitchen state for a room (returns empty object on miss).
 */
export async function getKitchenState(
  runtime: IAgentRuntime,
  roomId: string,
): Promise<KitchenState> {
  const cacheKey = getCacheKey(roomId);
  try {
    const cached = await runtime.cacheManager?.get(cacheKey);
    if (cached && typeof cached === 'object') {
      return cached as KitchenState;
    }
  } catch {
    // ignore
  }
  return {};
}

/**
 * Merge partial updates into the cached kitchen state for a room.
 */
export async function updateKitchenState(
  runtime: IAgentRuntime,
  roomId: string,
  updates: Partial<KitchenState>,
): Promise<void> {
  const cacheKey = getCacheKey(roomId);
  const current = await getKitchenState(runtime, roomId);
  const merged: KitchenState = { ...current, ...updates };
  await runtime.cacheManager?.set(cacheKey, merged);
}
