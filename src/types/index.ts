// ============================================================================
// Kitchly - AI Kitchen Companion
// Core type definitions for Instacart integration, recipes, meal planning,
// and kitchen state management.
// ============================================================================

// ---------------------------------------------------------------------------
// Instacart API types
// ---------------------------------------------------------------------------

/**
 * A measurement for an ingredient or line item (e.g. 2 cups, 1 tbsp).
 */
export interface InstacartMeasurement {
  quantity: number;
  unit: string;
}

/**
 * A line item in a shopping list sent to the Instacart Products Link API.
 */
export interface InstacartLineItem {
  name: string;
  display_text?: string;
  line_item_measurements?: InstacartMeasurement[];
}

/**
 * An ingredient in a recipe sent to the Instacart Recipe API.
 */
export interface InstacartIngredient {
  name: string;
  display_text?: string;
  measurements?: InstacartMeasurement[];
}

/**
 * Request body for the Instacart recipe endpoint (POST /products/recipe).
 */
export interface InstacartRecipeRequest {
  title: string;
  image_url?: string;
  link_type: 'recipe';
  ingredients: InstacartIngredient[];
  instructions: string[];
  landing_page_configuration: InstacartLandingPageConfig;
}

/**
 * Request body for the Instacart shopping list endpoint
 * (POST /products/products_link).
 */
export interface InstacartShoppingListRequest {
  title: string;
  link_type: 'shopping_list';
  line_items: InstacartLineItem[];
  landing_page_configuration: InstacartLandingPageConfig;
}

/**
 * UTM and partner configuration embedded in every Instacart API request.
 */
export interface InstacartLandingPageConfig {
  partner_linkback_url?: string;
  utm_campaign: string;
  utm_medium: string;
  utm_source: string;
  utm_term: string;
  utm_content: string;
}

/**
 * Successful response from the Instacart Products Link or Recipe API.
 */
export interface InstacartResponse {
  products_link_url: string;
}

// ---------------------------------------------------------------------------
// Kitchen domain types
// ---------------------------------------------------------------------------

/**
 * A parsed recipe with ingredients, instructions, and optional metadata.
 */
export interface Recipe {
  title: string;
  ingredients: InstacartIngredient[];
  instructions: string[];
  servings?: number;
  prepTime?: string;
  cookTime?: string;
  cuisine?: string;
  dietaryTags?: string[];
}

/**
 * A single day within a meal plan, containing one or more meals.
 */
export interface MealPlanDay {
  day: string;
  meals: {
    type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    recipe: string;
    description?: string;
  }[];
}

/**
 * A multi-day meal plan with a consolidated shopping list.
 */
export interface MealPlan {
  title: string;
  days: MealPlanDay[];
  consolidatedList: InstacartLineItem[];
  mealPlanText: string;
}

/**
 * Tracks an active step-by-step cooking session.
 */
export interface CookingSession {
  recipe: Recipe;
  currentStep: number;
  startedAt: Date;
  isPaused: boolean;
}

/**
 * Top-level kitchen state persisted across agent interactions.
 */
export interface KitchenState {
  currentRecipe?: Recipe;
  currentMealPlan?: MealPlan;
  cookingSession?: CookingSession;
  productsLinkUrl?: string;
  userPreferences?: UserPreferences;
}

/**
 * User-specific dietary and cooking preferences.
 */
export interface UserPreferences {
  dietaryRestrictions?: string[];
  allergies?: string[];
  cuisinePreferences?: string[];
  servingSize?: number;
  budget?: 'budget' | 'moderate' | 'premium';
  cookingSkill?: 'beginner' | 'intermediate' | 'advanced';
}

// ---------------------------------------------------------------------------
// Intent classification
// ---------------------------------------------------------------------------

/**
 * The inferred intent behind a user's grocery-related message.
 */
export type GroceryIntent =
  | 'recipe'
  | 'shopping_list'
  | 'meal_plan'
  | 'cook_along'
  | 'unknown';
