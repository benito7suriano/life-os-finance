// Surfing level thresholds and metadata
export const SURFING_LEVELS = {
  kook: {
    name: "Kook",
    minXp: 0,
    maxXp: 99,
    color: "#94a3b8", // slate-400
    icon: "🏄",
  },
  intermediate: {
    name: "Intermediate",
    minXp: 100,
    maxXp: 499,
    color: "#14b8a6", // teal-500
    icon: "🌊",
  },
  performance: {
    name: "Performance",
    minXp: 500,
    maxXp: 1999,
    color: "#0f4c81", // ocean blue
    icon: "🏄‍♂️",
  },
  pro: {
    name: "Pro",
    minXp: 2000,
    maxXp: Number.POSITIVE_INFINITY,
    color: "#f97316", // orange-500
    icon: "🔥",
  },
} as const

// XP rewards
export const XP_REWARDS = {
  addTransaction: 5,
  verifyTransaction: 2,
  connectWhatsApp: 50,
  firstTransaction: 25,
  weeklyStreak: 20,
} as const

// Account type icons
export const ACCOUNT_ICONS = {
  checking: "wallet",
  savings: "piggy-bank",
  credit: "credit-card",
  cash: "banknote",
  investment: "trending-up",
} as const

// Default account colors
export const ACCOUNT_COLORS = {
  checking: "#3b82f6", // blue
  savings: "#22c55e", // green
  credit: "#f97316", // orange
  cash: "#8b5cf6", // purple
  investment: "#0f4c81", // ocean blue
} as const
