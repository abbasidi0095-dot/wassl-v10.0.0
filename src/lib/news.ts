/**
 * Short, factual announcements shown in the home promo ticker. Keep this list
 * small and only add news that is true for the live app.
 */
export const WASSL_NEWS = [
  { id: "cash", text: "Cash on delivery in every city" },
  { id: "club", text: "Wassl Club points on every order" },
  { id: "cities", text: "Now serving 209 Moroccan cities" },
] as const;

export type WasslNewsItem = (typeof WASSL_NEWS)[number];
