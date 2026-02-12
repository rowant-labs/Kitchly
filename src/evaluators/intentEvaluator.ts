import type {
  Evaluator,
  IAgentRuntime,
  Memory,
  State,
} from '@elizaos/core';
import { ModelType } from '@elizaos/core';
import type { GroceryIntent } from '../types/index.js';

/** Keywords that indicate a food- or cooking-related message. */
const KITCHEN_KEYWORDS = [
  'recipe',
  'cook',
  'cooking',
  'meal',
  'grocery',
  'groceries',
  'shopping',
  'ingredients',
  'dinner',
  'lunch',
  'breakfast',
  'food',
  'eat',
  'make',
  'prepare',
  'plan',
  'week',
  'instacart',
  'order',
  'bake',
  'baking',
  'roast',
  'grill',
  'fry',
  'saute',
  'snack',
  'dessert',
  'appetizer',
  'dish',
  'cuisine',
  'pantry',
  'kitchen',
  'menu',
  'serve',
  'nutrition',
  'diet',
  'vegan',
  'vegetarian',
  'gluten-free',
  'keto',
  'paleo',
];

/**
 * intentEvaluator -- Classifies user messages into one of the four
 * kitchen intent categories so that subsequent actions can be routed
 * appropriately: recipe, meal_plan, shopping_list, or cook_along.
 */
export const intentEvaluator: Evaluator = {
  name: 'KITCHEN_INTENT',
  description:
    'Classifies user intent as recipe, meal_plan, shopping_list, or cook_along',
  alwaysRun: false,

  examples: [
    {
      prompt: 'Can you give me a recipe for chicken parmesan?',
      messages: [
        {
          user: '{{user1}}',
          content: { text: 'Can you give me a recipe for chicken parmesan?' },
        },
      ],
      outcome: 'Intent classified as "recipe"',
    },
    {
      prompt: 'Plan my meals for the week',
      messages: [
        {
          user: '{{user1}}',
          content: { text: 'Plan my meals for the week' },
        },
      ],
      outcome: 'Intent classified as "meal_plan"',
    },
    {
      prompt: "I need a shopping list for tomorrow's dinner party",
      messages: [
        {
          user: '{{user1}}',
          content: { text: "I need a shopping list for tomorrow's dinner party" },
        },
      ],
      outcome: 'Intent classified as "shopping_list"',
    },
    {
      prompt: "Let's start cooking, walk me through the steps",
      messages: [
        {
          user: '{{user1}}',
          content: {
            text: "Let's start cooking, walk me through the steps",
          },
        },
      ],
      outcome: 'Intent classified as "cook_along"',
    },
  ],

  validate: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
  ): Promise<boolean> => {
    const text = (message.content?.text || '').toLowerCase();
    return KITCHEN_KEYWORDS.some((kw) => text.includes(kw));
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
  ): Promise<void> => {
    const userText = message.content?.text || '';
    if (!userText.trim()) return;

    const classificationPrompt = `You are a kitchen assistant intent classifier. Given the user's message, classify it into EXACTLY ONE of the following categories:

- "recipe" -- The user wants a specific recipe or wants to know how to cook a particular dish.
- "meal_plan" -- The user wants a meal plan for multiple days or wants help planning meals for a period of time.
- "shopping_list" -- The user wants a shopping/grocery list, wants to order groceries, or mentions Instacart directly.
- "cook_along" -- The user wants step-by-step cooking guidance, wants to start cooking, or is navigating cooking steps (next, previous, repeat, done).

If the message does not clearly fit any category, respond with "unknown".

Respond with ONLY the category name, nothing else.

User message: "${userText}"`;

    try {
      const response = (await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: classificationPrompt,
      })) as string;

      const intent = response.trim().toLowerCase().replace(/[^a-z_]/g, '') as GroceryIntent;
      const validIntents: GroceryIntent[] = [
        'recipe',
        'meal_plan',
        'shopping_list',
        'cook_along',
      ];

      const classifiedIntent: GroceryIntent = validIntents.includes(intent)
        ? intent
        : 'unknown';

      // Store the classified intent in the message metadata so actions can read it
      if (message.content) {
        (message.content as Record<string, any>).kitchenIntent = classifiedIntent;
      }
    } catch (error) {
      // On classification failure, fall back to keyword heuristics
      const text = userText.toLowerCase();
      let fallbackIntent: GroceryIntent = 'unknown';

      if (
        text.includes('step') ||
        text.includes('walk me through') ||
        text.includes('cook along') ||
        text.includes('start cooking') ||
        text.includes('next step') ||
        text.includes('previous step') ||
        text.includes('repeat')
      ) {
        fallbackIntent = 'cook_along';
      } else if (
        text.includes('meal plan') ||
        text.includes('plan my meals') ||
        text.includes('plan my week') ||
        text.includes('weekly plan')
      ) {
        fallbackIntent = 'meal_plan';
      } else if (
        text.includes('shopping list') ||
        text.includes('grocery list') ||
        text.includes('groceries') ||
        text.includes('instacart') ||
        text.includes('order ingredients')
      ) {
        fallbackIntent = 'shopping_list';
      } else if (
        text.includes('recipe') ||
        text.includes('how to make') ||
        text.includes('how to cook') ||
        text.includes('how do i make') ||
        text.includes('cook') ||
        text.includes('prepare')
      ) {
        fallbackIntent = 'recipe';
      }

      if (message.content) {
        (message.content as Record<string, any>).kitchenIntent = fallbackIntent;
      }
    }
  },
};
