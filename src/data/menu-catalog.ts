import type { ModifierGroup } from "@/lib/types";

/**
 * Authored demo menus. The establishment records come from real data, but the
 * menus below are written for this demo and locked at build time.
 */
export type MenuItemTemplate = {
  category: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
  popular?: boolean;
  tags?: string[];
  calories?: number;
  modifiers?: string;
};

export const MODIFIER_SETS: Record<string, ModifierGroup[]> = {
  main: [
    {
      id: "portion",
      name: "Portion",
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: "regular", name: "Regular", priceDelta: 0 },
        { id: "large", name: "Large", priceDelta: 15 },
      ],
    },
    {
      id: "spice",
      name: "Spice level",
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: "mild", name: "Mild", priceDelta: 0 },
        { id: "medium", name: "Medium", priceDelta: 0 },
        { id: "hot", name: "Hot", priceDelta: 0 },
      ],
    },
    {
      id: "extras",
      name: "Add extras",
      required: false,
      min: 0,
      max: 3,
      options: [
        { id: "bread", name: "Extra bread", priceDelta: 5 },
        { id: "olives", name: "Marinated olives", priceDelta: 6 },
        { id: "cheese", name: "Extra cheese", priceDelta: 8 },
        { id: "salad", name: "Side salad", priceDelta: 12 },
      ],
    },
  ],
  burger: [
    {
      id: "patty",
      name: "Patty",
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: "single", name: "Single", priceDelta: 0 },
        { id: "double", name: "Double", priceDelta: 20 },
      ],
    },
    {
      id: "extras",
      name: "Extras",
      required: false,
      min: 0,
      max: 4,
      options: [
        { id: "cheese", name: "Cheddar slice", priceDelta: 6 },
        { id: "egg", name: "Fried egg", priceDelta: 6 },
        { id: "jalapeno", name: "Jalapeños", priceDelta: 4 },
        { id: "fries", name: "Make it a menu with fries", priceDelta: 18 },
      ],
    },
  ],
  tagine: [
    {
      id: "bread",
      name: "Bread",
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: "yes", name: "Fresh khobz", priceDelta: 5 },
        { id: "no", name: "No bread", priceDelta: 0 },
      ],
    },
    {
      id: "spice",
      name: "Spice level",
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: "mild", name: "Mild", priceDelta: 0 },
        { id: "medium", name: "Medium", priceDelta: 0 },
        { id: "hot", name: "Hot", priceDelta: 0 },
      ],
    },
  ],
  couscous: [
    {
      id: "portion",
      name: "Portion",
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: "single", name: "Single", priceDelta: 0 },
        { id: "sharing", name: "Sharing (2 people)", priceDelta: 45 },
      ],
    },
    {
      id: "extras",
      name: "Extras",
      required: false,
      min: 0,
      max: 2,
      options: [
        { id: "raisins", name: "Caramelised raisins", priceDelta: 6 },
        { id: "buttermilk", name: "Lben (buttermilk)", priceDelta: 8 },
      ],
    },
  ],
  salad: [
    {
      id: "addons",
      name: "Add to your salad",
      required: false,
      min: 0,
      max: 2,
      options: [
        { id: "tuna", name: "Tuna", priceDelta: 10 },
        { id: "avocado", name: "Avocado", priceDelta: 8 },
        { id: "egg", name: "Boiled egg", priceDelta: 5 },
      ],
    },
  ],
  drink: [
    {
      id: "size",
      name: "Size",
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: "regular", name: "33 cl", priceDelta: 0 },
        { id: "large", name: "50 cl", priceDelta: 5 },
      ],
    },
    {
      id: "ice",
      name: "Ice",
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: "ice", name: "With ice", priceDelta: 0 },
        { id: "no-ice", name: "No ice", priceDelta: 0 },
      ],
    },
  ],
  coffee: [
    {
      id: "milk",
      name: "Milk",
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: "whole", name: "Whole milk", priceDelta: 0 },
        { id: "oat", name: "Oat milk", priceDelta: 6 },
        { id: "none", name: "No milk", priceDelta: 0 },
      ],
    },
    {
      id: "size",
      name: "Size",
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: "small", name: "Small", priceDelta: 0 },
        { id: "large", name: "Large", priceDelta: 7 },
      ],
    },
  ],
  side: [
    {
      id: "size",
      name: "Size",
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: "regular", name: "Regular", priceDelta: 0 },
        { id: "large", name: "Large", priceDelta: 10 },
      ],
    },
    {
      id: "sauce",
      name: "Sauce",
      required: false,
      min: 0,
      max: 2,
      options: [
        { id: "harissa", name: "Harissa mayo", priceDelta: 3 },
        { id: "garlic", name: "Garlic sauce", priceDelta: 3 },
        { id: "ketchup", name: "Ketchup", priceDelta: 0 },
      ],
    },
  ],
  bread: [
    {
      id: "count",
      name: "How many?",
      required: true,
      min: 1,
      max: 1,
      options: [
        { id: "two", name: "2 pieces", priceDelta: 0 },
        { id: "four", name: "4 pieces", priceDelta: 6 },
      ],
    },
  ],
};

const item = (
  category: string,
  name: string,
  description: string,
  price: number,
  emoji: string,
  options: { popular?: boolean; tags?: string[]; modifiers?: string; calories?: number } = {},
): MenuItemTemplate => ({ category, name, description, price, emoji, ...options });

export const MENUS: Record<string, MenuItemTemplate[]> = {
  moroccan: [
    item("Tagines", "Chicken Tagine", "Slow-cooked chicken, preserved lemon, green olives", 72, "🍲", { popular: true, modifiers: "tagine", calories: 620 }),
    item("Tagines", "Kefta Tagine", "Beef meatballs, tomato, egg, cumin", 68, "🍳", { modifiers: "tagine", calories: 580 }),
    item("Tagines", "Fish Tagine", "White fish, chermoula, potatoes, peppers", 85, "🐟", { tags: ["Seafood"], modifiers: "tagine", calories: 540 }),
    item("Couscous", "Friday Couscous", "Seven vegetables, chickpeas, tender lamb", 82, "🌾", { popular: true, modifiers: "couscous", calories: 720 }),
    item("Couscous", "Vegetable Couscous", "Seasonal vegetables, chickpeas, raisins", 62, "🥕", { tags: ["Vegetarian"], modifiers: "couscous", calories: 540 }),
    item("Grill", "Mixed Grill", "Chicken skewer, kefta, merguez, bread", 95, "🍢", { modifiers: "main", calories: 780 }),
    item("Grill", "Grilled Chicken", "Half chicken, charmoula, fries", 78, "🍗", { modifiers: "main", calories: 690 }),
    item("Salads", "Moroccan Salad", "Tomato, cucumber, onion, parsley, lemon", 32, "🥗", { tags: ["Vegan"], modifiers: "salad", calories: 180 }),
    item("Salads", "Zaalouk", "Smoked aubergine, tomato, garlic, olive oil", 36, "🍆", { tags: ["Vegan"], modifiers: "bread", calories: 240 }),
    item("Bread", "Msemen", "Layered flatbread, honey and butter", 22, "🥞", { modifiers: "bread" }),
    item("Drinks", "Moroccan Mint Tea", "Pot for two, fresh mint", 20, "🫖", { popular: true }),
    item("Drinks", "Orange Juice", "Freshly pressed, no sugar", 18, "🍊", { tags: ["Vegan"], modifiers: "drink" }),
    item("Desserts", "Sellou", "Toasted almond and sesame sweet, 150g", 24, "🍪", { tags: ["Vegetarian"] }),
    item("Desserts", "Orange & Cinnamon", "Sliced orange, cinnamon, almond", 22, "🍊", { tags: ["Vegan"], calories: 160 }),
  ],
  seafood: [
    item("Starters", "Prawn Pil-Pil", "Garlic, chilli, olive oil, bread", 65, "🍤", { popular: true, modifiers: "bread", calories: 340 }),
    item("Starters", "Fish Soup", "Saffron broth, croutons, rouille", 42, "🥣", { calories: 260 }),
    item("Starters", "Oysters (6)", "Lemon, mignonette", 90, "🦪", { tags: ["Seafood"] }),
    item("Grilled fish", "Sea Bream", "Whole grilled bream, chermoula, salad", 140, "🐟", { popular: true, modifiers: "main", calories: 520 }),
    item("Grilled fish", "Sole Meunière", "Butter, lemon, parsley, potatoes", 155, "🐠", { tags: ["Seafood"], modifiers: "main", calories: 610 }),
    item("Grilled fish", "Calamari", "Grilled squid, garlic, paprika", 98, "🦑", { modifiers: "main", calories: 430 }),
    item("Tagines", "Fish Tagine", "Chermoula, tomato, peppers, olives", 110, "🍲", { modifiers: "tagine", calories: 480 }),
    item("Sides", "Patatas Bravas", "Crispy potatoes, spicy sauce", 38, "🥔", { tags: ["Vegetarian"], modifiers: "side" }),
    item("Sides", "Green Salad", "Leaves, tomato, lemon dressing", 28, "🥗", { tags: ["Vegan"], modifiers: "salad" }),
    item("Drinks", "Sparkling Water", "50 cl, chilled", 14, "💧", { modifiers: "drink" }),
    item("Drinks", "Fresh Lemonade", "Lemon, mint, lightly sweet", 22, "🍋", { tags: ["Vegan"], modifiers: "drink" }),
    item("Desserts", "Pastel de Nata", "Two custard tarts, cinnamon", 26, "🥮", { tags: ["Vegetarian"] }),
  ],
  grill: [
    item("Grills", "Chicken Skewers", "Two skewers, fries, salad, bread", 72, "🍢", { popular: true, modifiers: "main", calories: 640 }),
    item("Grills", "Kefta Skewers", "Spiced minced beef, onion, tomato", 76, "🍖", { modifiers: "main", calories: 690 }),
    item("Grills", "Lamb Chops", "Charcoal grilled, cumin salt", 120, "🥩", { modifiers: "main", calories: 760 }),
    item("Grills", "Mixed Grill Platter", "Chicken, kefta, merguez, liver", 135, "🔥", { popular: true, modifiers: "main" }),
    item("Sandwiches", "Kefta Sandwich", "Kefta, onion, harissa, khobz", 42, "🌯", { modifiers: "side" }),
    item("Sandwiches", "Chicken Sandwich", "Grilled chicken, garlic mayo, pickles", 38, "🥙", { modifiers: "side" }),
    item("Sides", "Hand-Cut Fries", "Sea salt, house sauce", 24, "🍟", { tags: ["Vegetarian"], modifiers: "side" }),
    item("Sides", "Grilled Vegetables", "Courgette, pepper, aubergine", 30, "🍆", { tags: ["Vegan"], modifiers: "side" }),
    item("Salads", "Tomato & Onion", "Tomato, onion, coriander, cumin", 26, "🥗", { tags: ["Vegan"], modifiers: "salad" }),
    item("Drinks", "Mint Tea", "Pot for two", 18, "🫖", { popular: true }),
    item("Drinks", "Soda", "Cola, lemon or orange", 12, "🥤", { modifiers: "drink" }),
    item("Desserts", "Grilled Banana", "Honey, cinnamon, almonds", 28, "🍌", { tags: ["Vegetarian"] }),
  ],
  fastfood: [
    item("Burgers", "Classic Smash", "Beef patty, cheddar, pickles, house sauce", 52, "🍔", { popular: true, modifiers: "burger", calories: 680 }),
    item("Burgers", "Double Cheese", "Two patties, double cheddar, onion", 72, "🍔", { modifiers: "burger", calories: 940 }),
    item("Burgers", "Crispy Chicken", "Buttermilk chicken, slaw, garlic mayo", 55, "🍗", { modifiers: "burger", calories: 720 }),
    item("Burgers", "Veggie Burger", "Chickpea patty, avocado, tomato", 48, "🥑", { tags: ["Vegetarian"], modifiers: "burger", calories: 540 }),
    item("Chicken", "Chicken Box", "Four pieces, fries, dip", 85, "🍗", { modifiers: "side", calories: 980 }),
    item("Chicken", "Chicken Wrap", "Grilled chicken, salad, harissa mayo", 46, "🌯", { modifiers: "side" }),
    item("Sides", "Fries", "Crispy, salted", 20, "🍟", { tags: ["Vegetarian"], modifiers: "side" }),
    item("Sides", "Loaded Fries", "Cheese, jalapeños, house sauce", 32, "🍟", { popular: true, modifiers: "side" }),
    item("Sides", "Onion Rings", "Six pieces, ranch dip", 26, "🧅", { tags: ["Vegetarian"], modifiers: "side" }),
    item("Drinks", "Milkshake", "Vanilla, chocolate or strawberry", 30, "🥤", { modifiers: "drink" }),
    item("Drinks", "Soda", "33 cl can", 12, "🥤", { modifiers: "drink" }),
    item("Desserts", "Chocolate Brownie", "Warm, with vanilla ice cream", 32, "🍫", { tags: ["Vegetarian"] }),
  ],
  cafe: [
    item("Breakfast", "Msemen & Amlou", "Warm msemen, argan amlou, honey", 30, "🥞", { popular: true, tags: ["Vegetarian"] }),
    item("Breakfast", "Egg & Olive Plate", "Two eggs, olives, tomato, bread", 38, "🍳", { tags: ["Vegetarian"], modifiers: "bread" }),
    item("Breakfast", "Avocado Toast", "Sourdough, avocado, poached egg", 45, "🥑", { tags: ["Vegetarian"] }),
    item("Breakfast", "Breakfast Tray", "Msemen, egg, cheese, jam, coffee", 68, "🍽️", { popular: true }),
    item("Coffee", "Espresso", "Double shot, house blend", 16, "☕", { modifiers: "coffee" }),
    item("Coffee", "Flat White", "Double espresso, steamed milk", 24, "☕", { popular: true, modifiers: "coffee" }),
    item("Coffee", "Iced Latte", "Espresso, cold milk, ice", 28, "🧊", { modifiers: "coffee" }),
    item("Coffee", "Mint Tea", "Traditional pot", 18, "🫖"),
    item("Juices", "Orange & Ginger", "Freshly pressed", 22, "🍊", { tags: ["Vegan"], modifiers: "drink" }),
    item("Juices", "Avocado Smoothie", "Avocado, milk, honey, almond", 32, "🥤", { tags: ["Vegetarian"], modifiers: "drink" }),
    item("Sweet", "Nutella Crêpe", "Fresh crêpe, banana, Nutella", 36, "🥞", { tags: ["Vegetarian"] }),
    item("Sweet", "Cheesecake", "Baked, berry coulis", 34, "🍰", { tags: ["Vegetarian"] }),
  ],
};
