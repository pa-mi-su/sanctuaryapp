// utils/theme.ts
//
// App-wide theme tokens (keep this tiny and stable).
// "Sanctuary" branding: navy + teal + near-black.
// Use these across tabs/screens so we don't duplicate colors everywhere.

export type LiturgicalSeason =
  | "Advent"
  | "Christmas"
  | "Lent"
  | "Easter"
  | "Ordinary Time";

export const AppTheme = {
  brandName: "Sanctuary",

  // Background gradients for screens (LinearGradient)
  gradients: {
    // Deep “sanctuary” navy -> teal -> near-black
    main: ["#17324A", "#0F4C5C", "#0B1320"] as const,
  },

  /**
   * Season outline colors
   *
   * Liturgical fidelity:
   * - Advent: Purple/Violet
   * - Christmas: White/Gold (we use Gold so it's visible as an outline)
   * - Lent: Purple/Violet (distinct from Advent via warmer hue)
   * - Easter: White/Gold (we use White)
   * - Ordinary Time: Green
   *
   * UI constraints:
   * - readable on dark bg
   * - distinct at small outline widths
   * - not neon
   */
  seasons: {
    // Advent = violet (cooler purple)
    Advent: "rgba(120, 88, 185, 0.95)",

    // Christmas = gold (outline must be visible; white can look like "no season")
    Christmas: "rgba(220, 185, 105, 0.95)",

    // Lent = purple (warmer, red-leaning purple so it won't be confused with Advent)
    Lent: "rgba(155, 80, 135, 0.95)",

    // Easter = white
    Easter: "rgba(245, 245, 250, 0.95)",

    // Ordinary Time = green
    "Ordinary Time": "rgba(60, 155, 95, 0.95)",
  } as const,

  // Fallback outline when season is unknown
  outlineFallback: "rgba(255,255,255,0.35)",
} as const;

export function seasonOutlineColor(
  season?: LiturgicalSeason,
): string | undefined {
  if (!season) return undefined;
  return AppTheme.seasons[season];
}
