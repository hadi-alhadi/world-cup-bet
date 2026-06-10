// Pure badge catalog — NO server-only imports (Prisma, node:*), so it is safe to import
// from client components. The server-side award logic + DB queries live in lib/badges.ts.

export interface BadgeDef {
  key: string;
  name: string;
  emoji: string;
  description: string;
}

// "Full House" intentionally excluded per scope.
export const BADGES: BadgeDef[] = [
  { key: "sniper", name: "Sniper", emoji: "🎯", description: "Predicted an exact scoreline." },
  { key: "hot_streak", name: "Hot Streak", emoji: "🔥", description: "5 correct predictions in a row." },
  { key: "against_the_odds", name: "Against the Odds", emoji: "🃏", description: "Called it when fewer than 20% agreed." },
  { key: "early_bird", name: "Early Bird", emoji: "🐦", description: "Bet within an hour of the window opening." },
  { key: "prophet", name: "Prophet", emoji: "🔮", description: "Picked the tournament champion correctly." },
];

export const BADGE_BY_KEY: Record<string, BadgeDef> = Object.fromEntries(
  BADGES.map((b) => [b.key, b]),
);

export interface BadgeWallEntry extends BadgeDef {
  earned: boolean;
  awardedAt: string | null;
}
