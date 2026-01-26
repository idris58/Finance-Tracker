import {
  BookOpen,
  Briefcase,
  Bus,
  Coins,
  CreditCard,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Home,
  Landmark,
  MoreHorizontal,
  PiggyBank,
  ShoppingBag,
  Stethoscope,
  Utensils,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type IconEntry = {
  icon: LucideIcon;
  className: string;
};

const iconMap: Record<string, IconEntry> = {
  Food: { icon: Utensils, className: "text-orange-500" },
  Transport: { icon: Bus, className: "text-sky-500" },
  Shopping: { icon: ShoppingBag, className: "text-fuchsia-500" },
  Bills: { icon: CreditCard, className: "text-slate-500" },
  Grocery: { icon: ShoppingBag, className: "text-emerald-500" },
  Health: { icon: HeartPulse, className: "text-rose-500" },
  Education: { icon: GraduationCap, className: "text-indigo-500" },
  Rentals: { icon: Home, className: "text-amber-500" },
  Medical: { icon: Stethoscope, className: "text-rose-500" },
  Other: { icon: MoreHorizontal, className: "text-slate-500" },
  Salary: { icon: Briefcase, className: "text-emerald-500" },
  Business: { icon: Landmark, className: "text-purple-500" },
  Investment: { icon: Coins, className: "text-indigo-500" },
  Interest: { icon: Coins, className: "text-yellow-500" },
  Extra: { icon: BookOpen, className: "text-cyan-500" },
  "Other Income": { icon: PiggyBank, className: "text-slate-500" },
  Borrow: { icon: HandCoins, className: "text-rose-500" },
  Lend: { icon: HandCoins, className: "text-emerald-500" },
};

export function getCategoryIcon(name?: string | null): IconEntry {
  if (!name) {
    return { icon: Wallet, className: "text-muted-foreground" };
  }

  if (name === "Loan") {
    return iconMap.Lend;
  }

  return iconMap[name] ?? { icon: Wallet, className: "text-muted-foreground" };
}
