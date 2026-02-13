import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from '@elizaos/core';
import { ModelType } from '@elizaos/core';
import type { InstacartService } from '../services/instacartService.js';
import { updateKitchenState } from '../providers/kitchenProvider.js';
import type { Recipe, InstacartIngredient } from '../types/index.js';

// ---------------------------------------------------------------------------
// Prompt used to extract a structured recipe from the conversation
// ---------------------------------------------------------------------------
const RECIPE_GENERATION_PROMPT = `You are a professional chef and recipe writer. Based on the user's request, generate a complete, detailed recipe in strict JSON format.

IMPORTANT RULES:
- Include EVERY ingredient needed, including common pantry items (salt, pepper, oil, butter, water, etc.). Never assume the user has anything on hand.
- All ingredient quantities MUST be greater than 0.
- Use standard US measurements (cups, tablespoons, teaspoons, ounces, pounds).
- Instructions must be clear, numbered steps.
- Be specific about temperatures, times, and techniques.

Respond with ONLY valid JSON matching this schema (no markdown fencing, no extra text):

{
  "title": "string",
  "servings": number,
  "prepTime": "string (e.g. 15 minutes)",
  "cookTime": "string (e.g. 30 minutes)",
  "cuisine": "string or null",
  "dietaryTags": ["string"],
  "ingredients": [
    {
      "name": "ingredient name",
      "display_text": "2 cups all-purpose flour",
      "measurements": [{ "quantity": number, "unit": "string" }]
    }
  ],
  "instructions": ["Step 1 text", "Step 2 text"]
}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Validate that every ingredient has at least one measurement with qty > 0 */
function validateIngredients(ingredients: InstacartIngredient[]): InstacartIngredient[] {
  return ingredients.map((ing) => {
    const measurements = (ing.measurements || []).map((m) => ({
      ...m,
      quantity: m.quantity > 0 ? m.quantity : 1,
    }));
    // If no measurements at all, default to "1 unit"
    if (measurements.length === 0) {
      measurements.push({ quantity: 1, unit: 'unit' });
    }
    return { ...ing, measurements };
  });
}

/** Format a recipe into beautiful markdown for display. */
function formatRecipe(recipe: Recipe, instacartUrl?: string): string {
  const lines: string[] = [];

  lines.push(`# ${recipe.title}`);
  lines.push('');

  // Metadata row
  const meta: string[] = [];
  if (recipe.servings) meta.push(`**Servings:** ${recipe.servings}`);
  if (recipe.prepTime) meta.push(`**Prep Time:** ${recipe.prepTime}`);
  if (recipe.cookTime) meta.push(`**Cook Time:** ${recipe.cookTime}`);
  if (recipe.cuisine) meta.push(`**Cuisine:** ${recipe.cuisine}`);
  if (meta.length) {
    lines.push(meta.join(' | '));
    lines.push('');
  }

  if (recipe.dietaryTags?.length) {
    lines.push(`*Tags: ${recipe.dietaryTags.join(', ')}*`);
    lines.push('');
  }

  // Ingredients
  lines.push('## Ingredients');
  lines.push('');
  for (const ing of recipe.ingredients) {
    if (ing.display_text) {
      lines.push(`- ${ing.display_text}`);
    } else {
      const meas = ing.measurements
        ?.map((m) => `${m.quantity} ${m.unit}`)
        .join(', ');
      lines.push(meas ? `- ${meas} ${ing.name}` : `- ${ing.name}`);
    }
  }
  lines.push('');

  // Instructions
  lines.push('## Instructions');
  lines.push('');
  recipe.instructions.forEach((step, i) => {
    lines.push(`${i + 1}. ${step}`);
  });
  lines.push('');

  // Instacart link
  if (instacartUrl) {
    lines.push('---');
    lines.push('');
    lines.push(
      `**[Order ingredients on Instacart](${instacartUrl})** -- get everything delivered to your door!`,
    );
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export const createRecipeAction: Action = {
  name: 'CREATE_RECIPE',
  similes: ['MAKE_RECIPE', 'GET_RECIPE', 'FIND_RECIPE', 'COOK_SOMETHING', 'ORDER_INGREDIENTS', 'BUY_GROCERIES', 'SHOP_INSTACART', 'ORDER_ON_INSTACART'],
  description:
    'Creates a detailed recipe with ingredients and instructions, and generates a shoppable Instacart link for one-click grocery ordering. Use this whenever the user asks for a recipe OR wants to order/buy/shop for ingredients.',

  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
  ): Promise<boolean> => {
    const key = runtime.getSetting('INSTACART_API_KEY') || process.env.INSTACART_API_KEY;
    return !!key;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown> | undefined,
    callback?: HandlerCallback,
  ): Promise<{ success: boolean; text?: string; data?: Record<string, any>; error?: string }> => {
    try {
      // ------------------------------------------------------------------
      // 1. Use LLM to generate structured recipe
      // ------------------------------------------------------------------
      const userText = message.content?.text || '';

      const fullPrompt = `${RECIPE_GENERATION_PROMPT}

User request: "${userText}"`;

      const rawResponse = (await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt: fullPrompt,
      })) as string;

      // Extract JSON from the response (handle potential markdown fencing)
      let jsonStr = rawResponse.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      }

      let recipeData: any;
      try {
        recipeData = JSON.parse(jsonStr);
      } catch {
        return {
          success: false,
          error: 'Failed to parse recipe from the AI response. Please try rephrasing your request.',
        };
      }

      // Validate and sanitize
      if (
        !recipeData.title ||
        !Array.isArray(recipeData.ingredients) ||
        recipeData.ingredients.length === 0 ||
        !Array.isArray(recipeData.instructions) ||
        recipeData.instructions.length === 0
      ) {
        return {
          success: false,
          error: 'The generated recipe was incomplete. Please try again with more details.',
        };
      }

      const recipe: Recipe = {
        title: recipeData.title,
        ingredients: validateIngredients(recipeData.ingredients),
        instructions: recipeData.instructions,
        servings: recipeData.servings || 4,
        prepTime: recipeData.prepTime,
        cookTime: recipeData.cookTime,
        cuisine: recipeData.cuisine || undefined,
        dietaryTags: recipeData.dietaryTags || [],
      };

      // ------------------------------------------------------------------
      // 2. Create Instacart shoppable recipe page
      // ------------------------------------------------------------------
      let instacartUrl: string | undefined;
      try {
        const instacart = runtime.getService<InstacartService>('instacart');
        if (instacart) {
          const result = await instacart.createRecipe(recipe);
          instacartUrl = result.products_link_url;
        }
      } catch (err) {
        // Instacart is optional -- log but continue
        console.warn(
          '[Kitchly] Failed to create Instacart recipe link:',
          err instanceof Error ? err.message : err,
        );
      }

      // ------------------------------------------------------------------
      // 3. Update kitchen state
      // ------------------------------------------------------------------
      await updateKitchenState(runtime, message.roomId, {
        currentRecipe: recipe,
        productsLinkUrl: instacartUrl,
      });

      // ------------------------------------------------------------------
      // 4. Send Instacart link as a short follow-up
      //    (The REPLY action already sends the conversational recipe text,
      //     so we only need to deliver the shoppable link here.)
      // ------------------------------------------------------------------
      if (instacartUrl) {
        await callback?.({
          text: `**[Order ingredients on Instacart](${instacartUrl})** -- get everything delivered to your door!`,
        });
      }

      return {
        success: true,
        text: instacartUrl
          ? `Instacart link: ${instacartUrl}`
          : 'Recipe created (Instacart link unavailable)',
        data: {
          recipe,
          instacartUrl: instacartUrl || null,
        },
      };
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('[Kitchly] createRecipe error:', errMsg);
      return {
        success: false,
        error: `Sorry, I couldn't create that recipe: ${errMsg}`,
      };
    }
  },

  examples: [
    [
      {
        name: '{{user1}}',
        content: { text: 'Can you give me a recipe for chicken parmesan?' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Here is a delicious Chicken Parmesan recipe with a shoppable Instacart link!',
          actions: ['CREATE_RECIPE'],
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'I want to make pad thai tonight' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Great choice! Here is a Pad Thai recipe with everything you need.',
          actions: ['CREATE_RECIPE'],
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Can I order the ingredients for that recipe?' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Absolutely! I am generating a shoppable Instacart link for you right now.',
          actions: ['CREATE_RECIPE'],
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'How do I make a vegan chocolate cake?' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Here is a rich Vegan Chocolate Cake recipe -- completely dairy-free and egg-free!',
          actions: ['CREATE_RECIPE'],
        },
      },
    ],
  ],
};
