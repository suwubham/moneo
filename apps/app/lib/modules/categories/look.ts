// How a category looks: one icon and one data colour. Shared by server and client code.

export const categoryColors = ["blue", "orange", "aqua", "yellow", "magenta", "green", "violet", "red"] as const;
export type CategoryColor = (typeof categoryColors)[number];

export const categoryIcons = [
  "cart", "utensils", "coffee", "car", "bus", "fuel", "home", "bolt", "wifi", "phone", "heart", "pill",
  "bag", "shirt", "film", "music", "repeat", "plane", "school", "gift", "paw", "baby", "dumbbell", "sparkles",
  "briefcase", "laptop", "coins", "bank", "piggy", "receipt", "wallet", "tag",
] as const;
export type CategoryIcon = (typeof categoryIcons)[number];

export type Look = { icon: CategoryIcon; color: CategoryColor };

const rules: [RegExp, CategoryIcon, CategoryColor][] = [
  [/grocer|supermarket|food(?! ?court)|market|mart/i, "cart", "green"],
  [/dining|restaurant|eat|lunch|dinner|meal|khaja|momo/i, "utensils", "orange"],
  [/coffee|cafe|tea|snack/i, "coffee", "yellow"],
  [/fuel|petrol|gas station|diesel/i, "fuel", "red"],
  [/transport|taxi|ride|commute|bus|metro|train/i, "bus", "blue"],
  [/car|vehicle|parking|auto/i, "car", "blue"],
  [/rent|housing|home|mortgage|house/i, "home", "violet"],
  [/utilit|electric|water|power|bill/i, "bolt", "yellow"],
  [/internet|wifi|broadband/i, "wifi", "aqua"],
  [/phone|mobile|recharge|top.?up/i, "phone", "aqua"],
  [/health|medical|doctor|hospital|dental/i, "heart", "red"],
  [/pharma|medicine/i, "pill", "red"],
  [/shop|cloth|fashion|amazon|daraz/i, "bag", "magenta"],
  [/entertain|movie|cinema|game|fun|party/i, "film", "magenta"],
  [/music|spotify|concert/i, "music", "magenta"],
  [/subscri|membership|netflix/i, "repeat", "violet"],
  [/travel|trip|holiday|flight|vacation|hotel/i, "plane", "aqua"],
  [/educat|school|course|book|tuition|college/i, "school", "blue"],
  [/gift|donat|charity/i, "gift", "red"],
  [/pet|dog|cat\b/i, "paw", "orange"],
  [/kid|baby|child/i, "baby", "yellow"],
  [/gym|fitness|sport/i, "dumbbell", "green"],
  [/beauty|personal|care|salon|groom/i, "sparkles", "magenta"],
  [/salary|wage|payroll|pay\b|income/i, "briefcase", "green"],
  [/freelance|side|gig|contract/i, "laptop", "aqua"],
  [/interest|dividend|invest|return/i, "coins", "yellow"],
  [/saving/i, "piggy", "green"],
  [/refund|cashback|reimburse/i, "receipt", "blue"],
  [/tax|fee|bank|loan|emi/i, "bank", "violet"],
  [/pocket|allowance|cash/i, "wallet", "orange"],
];

// Colour follows the name, so a category keeps its colour wherever it shows up.
function hashColor(name: string): CategoryColor {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return categoryColors[h % categoryColors.length];
}

export function guessLook(name: string): Look {
  const hit = rules.find(([re]) => re.test(name));
  return hit ? { icon: hit[1], color: hit[2] } : { icon: "tag", color: hashColor(name) };
}

export function lookOf(c: { name: string; icon?: string | null; color?: string | null }): Look {
  const guess = guessLook(c.name);
  return {
    icon: (categoryIcons as readonly string[]).includes(c.icon ?? "") ? (c.icon as CategoryIcon) : guess.icon,
    color: (categoryColors as readonly string[]).includes(c.color ?? "") ? (c.color as CategoryColor) : guess.color,
  };
}

// Cashew stores colours as hex like "#ff4caf50" or "0xff4caf50"; pick the nearest of ours by hue.
const hues: [CategoryColor, number][] = [["red", 0], ["orange", 25], ["yellow", 45], ["green", 120], ["aqua", 165], ["blue", 215], ["violet", 255], ["magenta", 320]];
export function nearestColor(hex: string | null | undefined): CategoryColor | null {
  const m = hex?.match(/([0-9a-f]{6})$/i);
  if (!m) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.08) return null;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const deg = (h * 60 + 360) % 360;
  const dist = (a: number) => Math.min(Math.abs(a - deg), 360 - Math.abs(a - deg));
  return hues.reduce((best, cur) => (dist(cur[1]) < dist(best[1]) ? cur : best))[0];
}
