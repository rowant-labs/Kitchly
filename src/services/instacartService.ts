// ============================================================================
// Kitchly - Instacart API Service
//
// ElizaOS v1.x Service that creates shoppable recipe pages and shopping lists
// via the Instacart Developer Platform (IDP).
//
// Endpoints:
//   POST /products/recipe        - Create a recipe landing page
//   POST /products/products_link - Create a shopping list landing page
// ============================================================================

import { Service, type IAgentRuntime, elizaLogger } from '@elizaos/core';

import type {
  InstacartIngredient,
  InstacartLandingPageConfig,
  InstacartLineItem,
  InstacartRecipeRequest,
  InstacartResponse,
  InstacartShoppingListRequest,
  Recipe,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROD_BASE_URL = 'https://connect.instacart.com/idp/v1';
const DEV_BASE_URL = 'https://connect.dev.instacart.tools/idp/v1';

const REQUEST_TIMEOUT_MS = 30_000;
const CLIENT_NAME = 'Kitchly';
const CLIENT_VERSION = '1.0';

/** Affiliate tracking parameters included with every Instacart link. */
const AFFILIATE_CONFIG: Omit<InstacartLandingPageConfig, 'partner_linkback_url'> = {
  utm_campaign: 'kitchly',
  utm_medium: 'affiliate',
  utm_source: 'instacart_idp',
  utm_term: 'partnertype-mediapartner',
  utm_content: 'campaignid-20313_partnerid-6107940',
} as const;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validates that a string is non-empty after trimming.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Sanitise a single ingredient, ensuring required fields exist and
 * all measurement quantities are positive numbers.
 *
 * Throws if the ingredient is invalid and cannot be salvaged.
 */
function validateIngredient(ingredient: InstacartIngredient, index: number): InstacartIngredient {
  if (!isNonEmptyString(ingredient.name)) {
    throw new Error(`Ingredient at index ${index} is missing a valid "name".`);
  }

  const sanitised: InstacartIngredient = {
    name: ingredient.name.trim(),
  };

  if (isNonEmptyString(ingredient.display_text)) {
    sanitised.display_text = ingredient.display_text.trim();
  }

  if (Array.isArray(ingredient.measurements) && ingredient.measurements.length > 0) {
    sanitised.measurements = ingredient.measurements
      .filter((m) => {
        if (typeof m.quantity !== 'number' || m.quantity <= 0) {
          elizaLogger.warn(
            `[InstacartService] Dropping measurement with invalid quantity (${m.quantity}) for ingredient "${sanitised.name}".`,
          );
          return false;
        }
        if (!isNonEmptyString(m.unit)) {
          elizaLogger.warn(
            `[InstacartService] Dropping measurement with empty unit for ingredient "${sanitised.name}".`,
          );
          return false;
        }
        return true;
      })
      .map((m) => ({ quantity: m.quantity, unit: m.unit.trim() }));
  }

  return sanitised;
}

/**
 * Sanitise a single line item, ensuring required fields exist and
 * all measurement quantities are positive numbers.
 *
 * Throws if the line item is invalid and cannot be salvaged.
 */
function validateLineItem(item: InstacartLineItem, index: number): InstacartLineItem {
  if (!isNonEmptyString(item.name)) {
    throw new Error(`Line item at index ${index} is missing a valid "name".`);
  }

  const sanitised: InstacartLineItem = {
    name: item.name.trim(),
  };

  if (isNonEmptyString(item.display_text)) {
    sanitised.display_text = item.display_text.trim();
  }

  if (Array.isArray(item.line_item_measurements) && item.line_item_measurements.length > 0) {
    sanitised.line_item_measurements = item.line_item_measurements
      .filter((m) => {
        if (typeof m.quantity !== 'number' || m.quantity <= 0) {
          elizaLogger.warn(
            `[InstacartService] Dropping measurement with invalid quantity (${m.quantity}) for line item "${sanitised.name}".`,
          );
          return false;
        }
        if (!isNonEmptyString(m.unit)) {
          elizaLogger.warn(
            `[InstacartService] Dropping measurement with empty unit for line item "${sanitised.name}".`,
          );
          return false;
        }
        return true;
      })
      .map((m) => ({ quantity: m.quantity, unit: m.unit.trim() }));
  }

  return sanitised;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class InstacartService extends Service {
  static serviceType = 'instacart';
  capabilityDescription = 'Creates shoppable recipe pages and shopping lists via Instacart';

  private apiKey: string = '';
  private baseUrl: string = PROD_BASE_URL;

  // -----------------------------------------------------------------------
  // Construction & lifecycle
  // -----------------------------------------------------------------------

  /**
   * Factory method called by the ElizaOS runtime to initialise the service.
   *
   * Reads the Instacart API key from the runtime settings (key:
   * `INSTACART_API_KEY`). Automatically selects the dev or prod Instacart
   * endpoint based on `NODE_ENV`.
   */
  static async start(runtime: IAgentRuntime): Promise<InstacartService> {
    const instance = new InstacartService(runtime);

    const apiKey =
      runtime.getSetting('INSTACART_API_KEY') ??
      process.env.INSTACART_API_KEY;

    if (!apiKey) {
      throw new Error(
        '[InstacartService] Missing INSTACART_API_KEY. ' +
          'Set it in your agent settings or as an environment variable.',
      );
    }

    instance.apiKey = String(apiKey);

    // Always use the production Instacart API — the dev endpoint requires
    // separate credentials.  Set INSTACART_USE_DEV=true to override.
    const useDev = process.env.INSTACART_USE_DEV === 'true';
    instance.baseUrl = useDev ? DEV_BASE_URL : PROD_BASE_URL;

    elizaLogger.info(
      `[InstacartService] Starting (env=${useDev ? 'dev' : 'prod'}, url=${instance.baseUrl})`,
    );

    return instance;
  }

  /**
   * Called by the ElizaOS runtime when the agent shuts down.
   */
  async stop(): Promise<void> {
    elizaLogger.info('[InstacartService] Stopped.');
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Create a shoppable Instacart recipe page from a `Recipe` object.
   *
   * Validates all ingredients before sending the request and returns the
   * `products_link_url` that can be shared with the user.
   */
  async createRecipe(recipe: Recipe): Promise<InstacartResponse> {
    // --- Validate top-level fields ---
    if (!isNonEmptyString(recipe.title)) {
      throw new Error('[InstacartService] Recipe title must be a non-empty string.');
    }

    if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
      throw new Error('[InstacartService] Recipe must contain at least one ingredient.');
    }

    if (!Array.isArray(recipe.instructions) || recipe.instructions.length === 0) {
      throw new Error('[InstacartService] Recipe must contain at least one instruction step.');
    }

    // --- Validate & sanitise ingredients ---
    const ingredients = recipe.ingredients.map((ing, i) => validateIngredient(ing, i));

    // --- Sanitise instructions (drop empty strings) ---
    const instructions = recipe.instructions
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter((s) => s.length > 0);

    if (instructions.length === 0) {
      throw new Error(
        '[InstacartService] Recipe instructions must contain at least one non-empty step.',
      );
    }

    // --- Build request body ---
    const body: InstacartRecipeRequest = {
      title: recipe.title.trim(),
      image_url: 'https://www.kitchly.app/images/instakitchly.png',
      link_type: 'recipe',
      ingredients,
      instructions,
      landing_page_configuration: this.getLandingPageConfig(),
    };

    elizaLogger.info(
      `[InstacartService] Creating recipe "${body.title}" with ${ingredients.length} ingredient(s).`,
    );

    return this.apiRequest('/products/recipe', body);
  }

  /**
   * Create a shoppable Instacart shopping list page.
   *
   * Validates all line items before sending the request and returns the
   * `products_link_url` that can be shared with the user.
   */
  async createShoppingList(
    title: string,
    items: InstacartLineItem[],
  ): Promise<InstacartResponse> {
    // --- Validate top-level fields ---
    if (!isNonEmptyString(title)) {
      throw new Error('[InstacartService] Shopping list title must be a non-empty string.');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('[InstacartService] Shopping list must contain at least one item.');
    }

    // --- Validate & sanitise line items ---
    const lineItems = items.map((item, i) => validateLineItem(item, i));

    // --- Build request body ---
    const body: InstacartShoppingListRequest = {
      title: title.trim(),
      link_type: 'shopping_list',
      line_items: lineItems,
      landing_page_configuration: this.getLandingPageConfig(),
    };

    elizaLogger.info(
      `[InstacartService] Creating shopping list "${body.title}" with ${lineItems.length} item(s).`,
    );

    return this.apiRequest('/products/products_link', body);
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Returns the affiliate/UTM landing page configuration included with
   * every Instacart API request.
   */
  private getLandingPageConfig(): InstacartLandingPageConfig {
    return {
      ...AFFILIATE_CONFIG,
      partner_linkback_url: 'https://www.kitchly.app',
      enable_pantry_items: true,
    };
  }

  /**
   * Perform an authenticated POST request to the Instacart IDP API.
   *
   * - Adds the `keys.` prefix to the API key for the Bearer token.
   * - Enforces a 30-second timeout via `AbortController`.
   * - Parses the response and returns the `products_link_url`.
   */
  private async apiRequest(endpoint: string, body: unknown): Promise<InstacartResponse> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      elizaLogger.debug(`[InstacartService] POST ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiKey.startsWith('keys.') ? this.apiKey : `keys.${this.apiKey}`}`,
          'X-Instacart-Client': CLIENT_NAME,
          'X-Instacart-Client-Version': CLIENT_VERSION,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '<unable to read response body>');
        elizaLogger.error(
          `[InstacartService] API error: ${response.status} ${response.statusText} - ${errorBody}`,
        );
        throw new Error(
          `Instacart API returned ${response.status} ${response.statusText}: ${errorBody}`,
        );
      }

      const data = (await response.json()) as Record<string, unknown>;

      if (!isNonEmptyString(data.products_link_url)) {
        elizaLogger.error(
          '[InstacartService] API response missing products_link_url.',
          JSON.stringify(data),
        );
        throw new Error(
          'Instacart API response did not contain a valid products_link_url.',
        );
      }

      elizaLogger.info(
        `[InstacartService] Success - products_link_url: ${data.products_link_url}`,
      );

      return { products_link_url: data.products_link_url as string };
    } catch (error: unknown) {
      // Re-throw abort errors with a friendlier message.
      if (error instanceof DOMException && error.name === 'AbortError') {
        elizaLogger.error(
          `[InstacartService] Request to ${url} timed out after ${REQUEST_TIMEOUT_MS}ms.`,
        );
        throw new Error(
          `Instacart API request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`,
        );
      }

      // Re-throw all other errors as-is so callers get the original message.
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
