import { GROCERY_CATEGORIES } from "../constants";

// Keyword -> category. Checked as whole-word matches against the ingredient
// name (case-insensitive). Order matters a little (first match wins), so
// more specific terms are listed before broader ones. Not exhaustive —
// anything unmatched falls back to "Other" and is always editable by hand.
const KEYWORD_CATEGORY = [
  [["chicken", "turkey", "beef", "steak", "pork", "bacon", "sausage", "ham", "lamb", "ground beef", "ground turkey", "salmon", "shrimp", "fish", "tuna", "cod", "tilapia", "crab", "scallop"], "Meat & Seafood"],
  [["milk", "cream", "half and half", "half-and-half", "butter", "cheese", "yogurt", "egg", "eggs", "sour cream", "cream cheese", "buttermilk", "cottage cheese"], "Dairy & Eggs"],
  [["bread", "bun", "buns", "roll", "rolls", "tortilla", "bagel", "baguette", "pita", "naan", "croissant", "pie crust", "pizza dough"], "Bakery"],
  [["frozen", "ice cream", "popsicle"], "Frozen"],
  [["juice", "soda", "wine", "beer", "coffee", "tea", "water", "seltzer", "lemonade", "cocktail", "spirits", "liquor"], "Beverages"],
  [["salt", "pepper", "cumin", "paprika", "cinnamon", "oregano", "basil", "thyme", "rosemary", "garlic powder", "onion powder", "chili powder", "curry", "nutmeg", "vanilla extract", "bay leaf", "cayenne", "spice", "seasoning", "hot sauce", "soy sauce", "vinegar", "mustard", "ketchup", "mayonnaise", "mayo", "worcestershire", "sriracha", "salsa"], "Spices & Condiments"],
  [["onion", "garlic", "tomato", "lettuce", "spinach", "carrot", "celery", "pepper", "potato", "cucumber", "avocado", "lemon", "lime", "apple", "banana", "berries", "berry", "mushroom", "broccoli", "cauliflower", "zucchini", "squash", "corn", "cilantro", "parsley", "basil leaves", "ginger", "kale", "cabbage", "herbs", "scallion", "green onion", "shallot"], "Produce"],
  [["flour", "sugar", "rice", "pasta", "noodle", "oats", "oatmeal", "beans", "lentils", "quinoa", "cereal", "bread crumbs", "breadcrumbs", "baking soda", "baking powder", "yeast", "oil", "olive oil", "vegetable oil", "broth", "stock", "canned", "can ", "tortilla chips", "crackers", "nuts", "peanut butter", "honey", "syrup", "chocolate", "cocoa"], "Pantry & Dry Goods"],
];

export function categorizeIngredient(name) {
  const lower = (name || "").toLowerCase();
  for (const [keywords, category] of KEYWORD_CATEGORY) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return "Other";
}

export { GROCERY_CATEGORIES };
