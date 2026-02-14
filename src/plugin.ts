import type { Plugin } from '@elizaos/core';
import { createRecipeAction } from './actions/createRecipe.js';
import { planMealsAction } from './actions/planMeals.js';
import { cookAlongAction } from './actions/cookAlong.js';
import { confirmAndShopAction } from './actions/confirmAndShop.js';
import { kitchenProvider } from './providers/kitchenProvider.js';
import { intentEvaluator } from './evaluators/intentEvaluator.js';
import { InstacartService } from './services/instacartService.js';

/**
 * Kitchly -- AI Kitchen Companion plugin for ElizaOS v1.x
 *
 * Provides:
 *  - Recipe creation with shoppable Instacart links (CREATE_RECIPE)
 *  - Multi-day meal planning with consolidated shopping lists (PLAN_MEALS)
 *  - Voice-guided step-by-step cook-along sessions (COOK_ALONG)
 *  - Kitchen state provider for context-aware conversations
 *  - Intent classification evaluator for routing kitchen-related messages
 *
 * Required settings:
 *  - INSTACART_API_KEY  -- Instacart Developer Platform API key
 */
export const kitchenPlugin: Plugin = {
  name: 'kitchly-kitchen',
  description:
    'AI Kitchen Companion - recipe creation, meal planning, cook-along guidance, and Instacart grocery ordering',

  init: async (_config: Record<string, string>, runtime) => {
    const apiKey = runtime.getSetting('INSTACART_API_KEY') || process.env.INSTACART_API_KEY;
    if (!apiKey) {
      console.warn(
        '[Kitchly] INSTACART_API_KEY not set - grocery ordering will be unavailable',
      );
    }
  },

  actions: [createRecipeAction, planMealsAction, cookAlongAction, confirmAndShopAction],
  providers: [kitchenProvider],
  evaluators: [intentEvaluator],
  services: [InstacartService],
};

export default kitchenPlugin;
