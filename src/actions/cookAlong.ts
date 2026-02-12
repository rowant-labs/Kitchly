import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from '@elizaos/core';
import { ModelType } from '@elizaos/core';
import {
  getKitchenState,
  updateKitchenState,
} from '../providers/kitchenProvider.js';
import type { Recipe, CookingSession, InstacartIngredient } from '../types/index.js';

// ---------------------------------------------------------------------------
// Navigation command detection
// ---------------------------------------------------------------------------

type NavCommand = 'next' | 'previous' | 'repeat' | 'done' | 'start' | 'status' | 'ingredients' | 'none';

/** Classify the user's message into a navigation command. */
function detectNavCommand(text: string): NavCommand {
  const t = text.toLowerCase().trim();

  if (/\b(done|finish|stop|end|exit|quit)\b/.test(t)) return 'done';
  if (/\b(next|continue|go on|move on|what'?s next|okay|ok|got it)\b/.test(t)) return 'next';
  if (/\b(previous|prev|back|go back|last step)\b/.test(t)) return 'previous';
  if (/\b(repeat|again|say that again|one more time|what was that)\b/.test(t)) return 'repeat';
  if (/\b(start|begin|let'?s go|let'?s cook|let'?s start|ready)\b/.test(t)) return 'start';
  if (/\b(where am i|what step|status|progress|how far)\b/.test(t)) return 'status';
  if (/\b(ingredients|what do i need|shopping list|supplies)\b/.test(t)) return 'ingredients';

  return 'none';
}

// ---------------------------------------------------------------------------
// Prompt for generating a recipe from scratch when none is active
// ---------------------------------------------------------------------------
const QUICK_RECIPE_PROMPT = `You are a professional chef. Generate a simple, easy-to-follow recipe in strict JSON format.

RULES:
- Instructions should be clear, short steps ideal for voice reading.
- Include ALL ingredients with quantities > 0 using standard US measurements.
- Keep each instruction step to 1-2 sentences maximum.

Respond with ONLY valid JSON (no markdown fencing):

{
  "title": "string",
  "servings": number,
  "prepTime": "string",
  "cookTime": "string",
  "ingredients": [
    { "name": "string", "display_text": "string", "measurements": [{ "quantity": number, "unit": "string" }] }
  ],
  "instructions": ["Step text"]
}`;

// ---------------------------------------------------------------------------
// Formatting helpers (voice-optimized: short, clear, no markdown)
// ---------------------------------------------------------------------------

function formatStepForVoice(
  recipe: Recipe,
  stepIndex: number,
): string {
  const total = recipe.instructions.length;
  const stepNum = stepIndex + 1;
  const instruction = recipe.instructions[stepIndex];

  return `Step ${stepNum} of ${total}: ${instruction}`;
}

function formatIngredientsForVoice(recipe: Recipe): string {
  const lines = recipe.ingredients.map((ing: InstacartIngredient) => {
    if (ing.display_text) return `- ${ing.display_text}`;
    const meas = ing.measurements
      ?.map((m) => `${m.quantity} ${m.unit}`)
      .join(', ');
    return meas ? `- ${meas} ${ing.name}` : `- ${ing.name}`;
  });
  return `Ingredients for ${recipe.title}:\n${lines.join('\n')}`;
}

function formatSessionStatus(session: CookingSession): string {
  const total = session.recipe.instructions.length;
  const current = session.currentStep + 1;
  const pct = Math.round((current / total) * 100);
  return (
    `You're on step ${current} of ${total} for ${session.recipe.title} (${pct}% complete).` +
    (session.isPaused ? ' The session is paused.' : '')
  );
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export const cookAlongAction: Action = {
  name: 'COOK_ALONG',
  similes: [
    'START_COOKING',
    'COOKING_MODE',
    'STEP_BY_STEP',
    'WALK_ME_THROUGH',
    'GUIDE_ME',
    'NEXT_STEP',
    'COOKING_GUIDE',
  ],
  description:
    'Enters voice-guided cooking mode. Walks the user through a recipe step by step. Supports navigation: next, previous, repeat, done.',

  validate: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
  ): Promise<boolean> => {
    // Cook-along doesn't strictly require Instacart -- it only needs a recipe
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown> | undefined,
    callback?: HandlerCallback,
  ): Promise<{ success: boolean; text?: string; data?: Record<string, any>; error?: string }> => {
    try {
      const userText = message.content?.text || '';
      const kitchenState = await getKitchenState(runtime, message.roomId);
      const navCommand = detectNavCommand(userText);

      // ================================================================
      // CASE A: Active cooking session exists -- handle navigation
      // ================================================================
      if (kitchenState.cookingSession) {
        const session = kitchenState.cookingSession;
        const totalSteps = session.recipe.instructions.length;

        switch (navCommand) {
          // ---- NEXT ----
          case 'next': {
            const nextStep = session.currentStep + 1;
            if (nextStep >= totalSteps) {
              // Recipe complete!
              await updateKitchenState(runtime, message.roomId, {
                cookingSession: undefined,
              });
              const doneText = `That was the last step! Your ${session.recipe.title} is complete. Enjoy your meal!`;
              await callback?.({ text: doneText });
              return { success: true, text: doneText, data: { finished: true } };
            }
            // Advance
            await updateKitchenState(runtime, message.roomId, {
              cookingSession: { ...session, currentStep: nextStep },
            });
            const stepText = formatStepForVoice(session.recipe, nextStep);
            await callback?.({ text: stepText });
            return {
              success: true,
              text: stepText,
              data: { currentStep: nextStep, totalSteps },
            };
          }

          // ---- PREVIOUS ----
          case 'previous': {
            const prevStep = Math.max(0, session.currentStep - 1);
            await updateKitchenState(runtime, message.roomId, {
              cookingSession: { ...session, currentStep: prevStep },
            });
            const stepText = formatStepForVoice(session.recipe, prevStep);
            await callback?.({ text: stepText });
            return {
              success: true,
              text: stepText,
              data: { currentStep: prevStep, totalSteps },
            };
          }

          // ---- REPEAT ----
          case 'repeat': {
            const stepText = formatStepForVoice(
              session.recipe,
              session.currentStep,
            );
            await callback?.({ text: stepText });
            return {
              success: true,
              text: stepText,
              data: { currentStep: session.currentStep, totalSteps },
            };
          }

          // ---- DONE ----
          case 'done': {
            await updateKitchenState(runtime, message.roomId, {
              cookingSession: undefined,
            });
            const doneText = `Cooking session ended for ${session.recipe.title}. Great job!`;
            await callback?.({ text: doneText });
            return { success: true, text: doneText, data: { finished: true } };
          }

          // ---- STATUS ----
          case 'status': {
            const statusText = formatSessionStatus(session);
            await callback?.({ text: statusText });
            return {
              success: true,
              text: statusText,
              data: { currentStep: session.currentStep, totalSteps },
            };
          }

          // ---- INGREDIENTS ----
          case 'ingredients': {
            const ingText = formatIngredientsForVoice(session.recipe);
            await callback?.({ text: ingText });
            return { success: true, text: ingText };
          }

          // ---- START (restart from step 1) ----
          case 'start': {
            await updateKitchenState(runtime, message.roomId, {
              cookingSession: { ...session, currentStep: 0, isPaused: false },
            });
            const restartText =
              `Restarting ${session.recipe.title} from the beginning.\n\n` +
              formatStepForVoice(session.recipe, 0);
            await callback?.({ text: restartText });
            return {
              success: true,
              text: restartText,
              data: { currentStep: 0, totalSteps },
            };
          }

          // ---- NONE (unrecognized -- use LLM to interpret) ----
          case 'none':
          default: {
            // Use LLM to figure out what the user wants in cooking context
            const contextPrompt = `You are a cooking assistant in the middle of guiding someone through "${session.recipe.title}". They are on step ${session.currentStep + 1} of ${totalSteps}.

Current step: "${session.recipe.instructions[session.currentStep]}"

The user said: "${userText}"

If they seem to be asking to move forward, respond with just "NEXT".
If they want to go back, respond with just "PREVIOUS".
If they want to hear the step again, respond with just "REPEAT".
If they want to stop cooking, respond with just "DONE".
If they are asking a cooking question about the current step, provide a brief, helpful answer (1-2 sentences max, optimized for voice).`;

            const llmResponse = (await runtime.useModel(ModelType.TEXT_SMALL, {
              prompt: contextPrompt,
            })) as string;

            const trimmed = llmResponse.trim().toUpperCase();
            if (trimmed === 'NEXT') {
              // Recursively handle as next
              const nextStep = session.currentStep + 1;
              if (nextStep >= totalSteps) {
                await updateKitchenState(runtime, message.roomId, {
                  cookingSession: undefined,
                });
                const doneText = `That was the last step! Your ${session.recipe.title} is complete. Enjoy your meal!`;
                await callback?.({ text: doneText });
                return { success: true, text: doneText, data: { finished: true } };
              }
              await updateKitchenState(runtime, message.roomId, {
                cookingSession: { ...session, currentStep: nextStep },
              });
              const stepText = formatStepForVoice(session.recipe, nextStep);
              await callback?.({ text: stepText });
              return {
                success: true,
                text: stepText,
                data: { currentStep: nextStep, totalSteps },
              };
            } else if (trimmed === 'PREVIOUS') {
              const prevStep = Math.max(0, session.currentStep - 1);
              await updateKitchenState(runtime, message.roomId, {
                cookingSession: { ...session, currentStep: prevStep },
              });
              const stepText = formatStepForVoice(session.recipe, prevStep);
              await callback?.({ text: stepText });
              return {
                success: true,
                text: stepText,
                data: { currentStep: prevStep, totalSteps },
              };
            } else if (trimmed === 'REPEAT') {
              const stepText = formatStepForVoice(session.recipe, session.currentStep);
              await callback?.({ text: stepText });
              return {
                success: true,
                text: stepText,
                data: { currentStep: session.currentStep, totalSteps },
              };
            } else if (trimmed === 'DONE') {
              await updateKitchenState(runtime, message.roomId, {
                cookingSession: undefined,
              });
              const doneText = `Cooking session ended for ${session.recipe.title}. Great job!`;
              await callback?.({ text: doneText });
              return { success: true, text: doneText, data: { finished: true } };
            } else {
              // LLM provided a helpful contextual answer
              await callback?.({ text: llmResponse.trim() });
              return {
                success: true,
                text: llmResponse.trim(),
                data: { currentStep: session.currentStep, totalSteps },
              };
            }
          }
        }
      }

      // ================================================================
      // CASE B: No active session -- start a new one
      // ================================================================

      let recipe: Recipe | undefined = kitchenState.currentRecipe;

      // If there's no active recipe, generate one from the user's message
      if (!recipe) {
        await callback?.({
          text: "I don't have a recipe loaded yet. Let me create one for you first...",
        });

        const fullPrompt = `${QUICK_RECIPE_PROMPT}

User request: "${userText}"`;

        const rawResponse = (await runtime.useModel(ModelType.TEXT_LARGE, {
          prompt: fullPrompt,
        })) as string;

        let jsonStr = rawResponse.trim();
        const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) {
          jsonStr = fenceMatch[1].trim();
        }

        try {
          const parsed = JSON.parse(jsonStr);
          if (
            parsed.title &&
            Array.isArray(parsed.ingredients) &&
            parsed.ingredients.length > 0 &&
            Array.isArray(parsed.instructions) &&
            parsed.instructions.length > 0
          ) {
            // Validate quantities > 0
            parsed.ingredients = parsed.ingredients.map((ing: any) => ({
              ...ing,
              measurements: (ing.measurements || []).map((m: any) => ({
                ...m,
                quantity: m.quantity > 0 ? m.quantity : 1,
              })),
            }));
            recipe = parsed as Recipe;
          }
        } catch {
          // parse failure handled below
        }

        if (!recipe) {
          const errText =
            'I could not generate a recipe from your request. Please try asking for a specific dish first, then start the cook-along.';
          await callback?.({ text: errText });
          return { success: false, error: errText };
        }

        // Save the generated recipe
        await updateKitchenState(runtime, message.roomId, {
          currentRecipe: recipe,
        });
      }

      // Create a new cooking session starting at step 0
      const newSession: CookingSession = {
        recipe,
        currentStep: 0,
        startedAt: new Date(),
        isPaused: false,
      };

      await updateKitchenState(runtime, message.roomId, {
        cookingSession: newSession,
      });

      const totalSteps = recipe.instructions.length;
      const introText =
        `Let's cook ${recipe.title}! I'll guide you step by step. ` +
        `There are ${totalSteps} steps total. Say "next" to advance, "repeat" to hear a step again, "previous" to go back, or "done" to end.\n\n` +
        formatStepForVoice(recipe, 0);

      await callback?.({ text: introText });

      return {
        success: true,
        text: introText,
        data: {
          recipeTitle: recipe.title,
          currentStep: 0,
          totalSteps,
          sessionStarted: true,
        },
      };
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('[Kitchly] cookAlong error:', errMsg);
      return {
        success: false,
        error: `Sorry, something went wrong with the cook-along: ${errMsg}`,
      };
    }
  },

  examples: [
    [
      {
        name: '{{user1}}',
        content: { text: "Let's start cooking the chicken parmesan" },
      },
      {
        name: '{{agent}}',
        content: {
          text: "Let's cook Chicken Parmesan! I'll guide you step by step. Step 1 of 8: Preheat your oven to 425 degrees F.",
          actions: ['COOK_ALONG'],
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Next step' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Step 2 of 8: Pound the chicken breasts to an even thickness of about half an inch.',
          actions: ['COOK_ALONG'],
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Can you repeat that?' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Step 2 of 8: Pound the chicken breasts to an even thickness of about half an inch.',
          actions: ['COOK_ALONG'],
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: "I'm done cooking" },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Cooking session ended for Chicken Parmesan. Great job!',
          actions: ['COOK_ALONG'],
        },
      },
    ],
  ],
};
