import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from '@elizaos/core';
import { ModelType } from '@elizaos/core';
import type { InstacartService } from '../services/instacartService.js';
import { updateKitchenState, getKitchenState } from '../providers/kitchenProvider.js';
import type {
  MealPlan,
  MealPlanDay,
  InstacartLineItem,
  InstacartMeasurement,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Prompt used to generate a multi-day meal plan with consolidated ingredients
// ---------------------------------------------------------------------------
const MEAL_PLAN_PROMPT = `You are a professional meal planner and nutritionist. Based on the user's request, generate a complete meal plan in strict JSON format.

IMPORTANT RULES:
- Each day should have breakfast, lunch, and dinner at minimum. Include snacks if the user requests them.
- Every meal must list its complete recipe name and a one-sentence description.
- Generate a CONSOLIDATED shopping list that combines all ingredients across every meal. Merge duplicates and sum their quantities.
- Include EVERY ingredient needed -- salt, pepper, oil, butter, water, spices, etc. Never assume the user has anything on hand.
- All ingredient quantities MUST be greater than 0.
- Use standard US measurements (cups, tablespoons, teaspoons, ounces, pounds).

Respond with ONLY valid JSON matching this schema (no markdown fencing, no extra text):

{
  "title": "string describing the plan",
  "days": [
    {
      "day": "Monday",
      "meals": [
        {
          "type": "breakfast" | "lunch" | "dinner" | "snack",
          "recipe": "Recipe Name",
          "description": "One-sentence description"
        }
      ]
    }
  ],
  "consolidatedList": [
    {
      "name": "ingredient name",
      "display_text": "3 lbs chicken breast",
      "line_item_measurements": [{ "quantity": number, "unit": "string" }]
    }
  ]
}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ensure every line item has a measurement with quantity > 0 */
function validateLineItems(items: InstacartLineItem[]): InstacartLineItem[] {
  return items.map((item) => {
    const measurements: InstacartMeasurement[] = (
      item.line_item_measurements || []
    ).map((m) => ({
      ...m,
      quantity: m.quantity > 0 ? m.quantity : 1,
    }));
    if (measurements.length === 0) {
      measurements.push({ quantity: 1, unit: 'unit' });
    }
    return { ...item, line_item_measurements: measurements };
  });
}

/** Format the meal plan into beautiful markdown. */
function formatMealPlan(plan: MealPlan, instacartUrl?: string): string {
  const lines: string[] = [];

  lines.push(`# ${plan.title}`);
  lines.push('');

  // Day-by-day breakdown
  for (const day of plan.days) {
    lines.push(`## ${day.day}`);
    lines.push('');
    for (const meal of day.meals) {
      const typeLabel =
        meal.type.charAt(0).toUpperCase() + meal.type.slice(1);
      const desc = meal.description ? ` -- ${meal.description}` : '';
      lines.push(`- **${typeLabel}:** ${meal.recipe}${desc}`);
    }
    lines.push('');
  }

  // Consolidated shopping list
  lines.push('## Consolidated Shopping List');
  lines.push('');
  for (const item of plan.consolidatedList) {
    if (item.display_text) {
      lines.push(`- ${item.display_text}`);
    } else {
      const meas = item.line_item_measurements
        ?.map((m) => `${m.quantity} ${m.unit}`)
        .join(', ');
      lines.push(meas ? `- ${meas} ${item.name}` : `- ${item.name}`);
    }
  }
  lines.push('');

  // Instacart link
  if (instacartUrl) {
    lines.push('---');
    lines.push('');
    lines.push(
      `**[Order all ingredients on Instacart](${instacartUrl})** -- one click to get everything delivered!`,
    );
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export const planMealsAction: Action = {
  name: 'PLAN_MEALS',
  similes: [
    'CREATE_MEAL_PLAN',
    'MEAL_PLAN',
    'WEEKLY_PLAN',
    'PLAN_MY_WEEK',
    'MEAL_PREP',
    'ORDER_GROCERY_LIST',
    'SHOP_FOR_MEALS',
    'BUY_MEAL_PLAN_INGREDIENTS',
  ],
  description:
    'Creates a multi-day meal plan with a consolidated shopping list and generates a shoppable Instacart link for one-click grocery ordering. Use this whenever the user asks for a meal plan OR wants to order/shop for a grocery list.',

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
      // 1. Gather context (user preferences if available)
      // ------------------------------------------------------------------
      const userText = message.content?.text || '';
      const kitchenState = await getKitchenState(runtime, message.roomId);

      let preferencesContext = '';
      if (kitchenState.userPreferences) {
        const up = kitchenState.userPreferences;
        const prefs: string[] = [];
        if (up.dietaryRestrictions?.length)
          prefs.push(`Dietary restrictions: ${up.dietaryRestrictions.join(', ')}`);
        if (up.allergies?.length)
          prefs.push(`Allergies (MUST avoid): ${up.allergies.join(', ')}`);
        if (up.cuisinePreferences?.length)
          prefs.push(`Preferred cuisines: ${up.cuisinePreferences.join(', ')}`);
        if (up.servingSize)
          prefs.push(`Preferred serving size: ${up.servingSize} people`);
        if (up.budget) prefs.push(`Budget level: ${up.budget}`);
        if (up.cookingSkill)
          prefs.push(`Cooking skill: ${up.cookingSkill}`);
        if (prefs.length) {
          preferencesContext = `\n\nUser preferences:\n${prefs.join('\n')}`;
        }
      }

      // ------------------------------------------------------------------
      // 2. Use LLM to generate the meal plan
      // ------------------------------------------------------------------
      const fullPrompt = `${MEAL_PLAN_PROMPT}${preferencesContext}

User request: "${userText}"`;

      const rawResponse = (await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt: fullPrompt,
      })) as string;

      // Extract JSON from response
      let jsonStr = rawResponse.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      }

      let planData: any;
      try {
        planData = JSON.parse(jsonStr);
      } catch {
        return {
          success: false,
          error:
            'Failed to parse the meal plan from the AI response. Please try rephrasing your request.',
        };
      }

      // Validate
      if (
        !planData.title ||
        !Array.isArray(planData.days) ||
        planData.days.length === 0 ||
        !Array.isArray(planData.consolidatedList)
      ) {
        return {
          success: false,
          error:
            'The generated meal plan was incomplete. Please try again with more details about how many days and dietary preferences.',
        };
      }

      // Validate each day has proper structure
      const days: MealPlanDay[] = planData.days.map((d: any) => ({
        day: d.day || 'Day',
        meals: Array.isArray(d.meals)
          ? d.meals.map((m: any) => ({
              type: m.type || 'dinner',
              recipe: m.recipe || 'Untitled Meal',
              description: m.description,
            }))
          : [],
      }));

      const consolidatedList = validateLineItems(planData.consolidatedList);

      // Build the full formatted text for embedding in the plan
      const mealPlanTextParts: string[] = [];
      for (const day of days) {
        mealPlanTextParts.push(day.day + ':');
        for (const meal of day.meals) {
          mealPlanTextParts.push(`  ${meal.type}: ${meal.recipe}`);
        }
      }

      const mealPlan: MealPlan = {
        title: planData.title,
        days,
        consolidatedList,
        mealPlanText: mealPlanTextParts.join('\n'),
      };

      // ------------------------------------------------------------------
      // 3. Create Instacart shoppable shopping list
      // ------------------------------------------------------------------
      let instacartUrl: string | undefined;
      try {
        const instacart = runtime.getService<InstacartService>('instacart');
        if (instacart) {
          const result = await instacart.createShoppingList(
            mealPlan.title,
            mealPlan.consolidatedList,
          );
          instacartUrl = result.products_link_url;
        }
      } catch (err) {
        console.warn(
          '[Kitchly] Failed to create Instacart shopping list link:',
          err instanceof Error ? err.message : err,
        );
      }

      // ------------------------------------------------------------------
      // 4. Update kitchen state
      // ------------------------------------------------------------------
      await updateKitchenState(runtime, message.roomId, {
        currentMealPlan: mealPlan,
        productsLinkUrl: instacartUrl,
      });

      // ------------------------------------------------------------------
      // 5. Send Instacart link as a short follow-up
      //    (The REPLY action already sends the conversational meal plan,
      //     so we only need to deliver the shoppable link here.)
      // ------------------------------------------------------------------
      if (instacartUrl) {
        await callback?.({
          text: `**[Order all ingredients on Instacart](${instacartUrl})** -- one click to get everything delivered!`,
        });
      }

      return {
        success: true,
        text: instacartUrl
          ? `Instacart link: ${instacartUrl}`
          : 'Meal plan created (Instacart link unavailable)',
        data: {
          mealPlan,
          instacartUrl: instacartUrl || null,
          totalDays: days.length,
          totalItems: consolidatedList.length,
        },
      };
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('[Kitchly] planMeals error:', errMsg);
      return {
        success: false,
        error: `Sorry, I couldn't create that meal plan: ${errMsg}`,
      };
    }
  },

  examples: [
    [
      {
        name: '{{user1}}',
        content: { text: 'Plan my meals for the week' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Here is your weekly meal plan with a consolidated shopping list!',
          actions: ['PLAN_MEALS'],
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: {
          text: 'I need a 5-day meal plan for two people, vegetarian and gluten-free',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Here is a 5-day vegetarian, gluten-free meal plan for two!',
          actions: ['PLAN_MEALS'],
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Can you plan healthy meals for Monday through Friday on a budget?' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Here is a budget-friendly, healthy weekday meal plan!',
          actions: ['PLAN_MEALS'],
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: "Let's order those ingredients" },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Creating your shoppable Instacart link now -- one click and everything gets delivered!',
          actions: ['PLAN_MEALS'],
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Send that grocery list to Instacart' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Generating your Instacart shopping link with the full grocery list!',
          actions: ['PLAN_MEALS'],
        },
      },
    ],
  ],
};
