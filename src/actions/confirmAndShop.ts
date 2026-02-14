import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from '@elizaos/core';
import { getKitchenState } from '../providers/kitchenProvider.js';

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export const confirmAndShopAction: Action = {
  name: 'CONFIRM_AND_SHOP',
  similes: [
    'READY_TO_SHOP',
    'CONFIRM_RECIPE',
    'LETS_MAKE_IT',
    'SOUNDS_GOOD',
  ],
  description:
    'When the user confirms interest in a previously suggested recipe or meal plan (e.g. "okay", "sure", "yes", "let\'s do it", "sounds good"), this action surfaces the existing Instacart shopping link so the user can order ingredients immediately without having to ask for the link separately.',

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
  ): Promise<boolean> => {
    // Only valid when there's already an active recipe/meal plan with an Instacart link
    const kitchenState = await getKitchenState(runtime, message.roomId);
    return !!kitchenState.productsLinkUrl;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown> | undefined,
    callback?: HandlerCallback,
  ): Promise<{ success: boolean; text?: string; data?: Record<string, any> }> => {
    const kitchenState = await getKitchenState(runtime, message.roomId);
    const url = kitchenState.productsLinkUrl;

    if (!url) {
      return {
        success: false,
        text: 'No active recipe or shopping link found.',
      };
    }

    await callback?.({
      text: `**[Order ingredients on Instacart](${url})** -- get everything delivered to your door!`,
    });

    return {
      success: true,
      text: `Instacart link: ${url}`,
      data: { instacartUrl: url },
    };
  },

  examples: [
    [
      {
        name: '{{user1}}',
        content: { text: 'Give me a quick pasta recipe' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Here\'s a quick Aglio e Olio — ready in 20 minutes.',
          actions: ['CREATE_RECIPE'],
        },
      },
      {
        name: '{{user1}}',
        content: { text: 'Okay, let\'s do it' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'You got it! Here\'s your link to grab everything on Instacart.',
          actions: ['CONFIRM_AND_SHOP'],
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Suggest a weeknight dinner' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'How about Sheet Pan Sausage and Peppers? 30 minutes, one pan.',
          actions: ['CREATE_RECIPE'],
        },
      },
      {
        name: '{{user1}}',
        content: { text: 'Sure, sounds good' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Here\'s your Instacart link to order everything you need.',
          actions: ['CONFIRM_AND_SHOP'],
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'What should I make for dinner tonight?' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Try a honey-garlic salmon — 25 minutes and incredibly satisfying.',
          actions: ['CREATE_RECIPE'],
        },
      },
      {
        name: '{{user1}}',
        content: { text: 'Yes!' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Great choice! Grab the ingredients here.',
          actions: ['CONFIRM_AND_SHOP'],
        },
      },
    ],
  ],
};
