import { useStats, useTransactions, useSettings } from "@/hooks/use-finance";
import { StatCard } from "@/components/StatCard";
import { format } from "date-fns";
import { Loader2, TrendingUp, TrendingDown, Target, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: transactions, isLoading: txLoading } = useTransactions({ limit: "5" });
  const { data: settings } = useSettings();

  const currency = settings?.currencySymbol || "৳";

  if (statsLoading || txLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-2xl bg-muted/20" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl bg-muted/20" />
      </div>
    );
  }

  // Safe defaults
  const totalBalance = stats?.totalBalance || 0;
  const safeToSpend = stats?.safeToSpendDaily || 0;
  const daysRemaining = stats?.daysRemaining || 1;
  const monthlySpent = stats?.monthlySpent || 0;
  const monthlyIncome = Number(settings?.monthlyIncome || 0);
  const isSetupComplete = settings?.isSetupComplete ?? false;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
            Overview
          </h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), "EEEE, d MMMM")}
          </p>
        </div>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {!isSetupComplete || monthlyIncome === 0 ? (
          <motion.div variants={item} className="md:col-span-2 lg:col-span-4">
            <div className="glass-card rounded-3xl p-8 border border-white/5 text-center">
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">Setup Required</h3>
              <p className="text-muted-foreground mb-4">
                Please set your income in Settings to see your Daily Limit and start tracking your expenses.
              </p>
              <a href="/settings" className="text-primary hover:text-primary/80 underline">
                Go to Settings →
              </a>
            </div>
          </motion.div>
        ) : (
          <>
            <motion.div variants={item}>
                <StatCard
                label="Safe to Spend"
                value={`${currency}${Math.round(safeToSpend).toLocaleString()}`}
                subtext={`Per day for ${daysRemaining} days`}
                icon={<ShieldCheck className="w-5 h-5" />}
                variant="primary"
                className="neon-glow border-primary/30"
                />
            </motion.div>
        
        <motion.div variants={item}>
            <StatCard
            label="Total Balance"
            value={`${currency}${totalBalance.toLocaleString()}`}
            subtext="Available funds"
            icon={<Target className="w-5 h-5" />}
            variant="default"
            />
        </motion.div>

        <motion.div variants={item}>
            <StatCard
            label="Monthly Spent"
            value={`${currency}${monthlySpent.toLocaleString()}`}
            subtext="This month"
            icon={<TrendingDown className="w-5 h-5" />}
            variant="danger"
            />
        </motion.div>

        <motion.div variants={item}>
            <StatCard
            label="Savings Goal"
            value={`${currency}${stats?.savingsGoal.toLocaleString()}`}
            subtext="Target for this month"
            icon={<TrendingUp className="w-5 h-5" />}
            variant="secondary"
            />
        </motion.div>
          </>
        )}
      </div>

      {/* Recent Activity */}
      <motion.section variants={item} className="glass-card rounded-3xl p-6 border border-white/5">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold font-display">Recent Activity</h2>
          <button className="text-sm text-primary hover:text-primary/80 transition-colors">View All</button>
        </div>

        <div className="space-y-4">
          {transactions?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No transactions yet. Start tracking!
            </div>
          ) : (
            transactions?.map((tx) => (
              <div 
                key={tx.id} 
                className="group flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center border border-white/10 group-hover:border-primary/50 transition-colors">
                     {/* Simplified icon logic */}
                     <span className="text-lg">
                        {tx.categoryName?.includes("Food") ? "🍔" :
                         tx.categoryName?.includes("Transport") ? "🚕" :
                         tx.categoryName?.includes("Shopping") ? "🛍️" : "💸"}
                     </span>
                  </div>
                  <div>
                    <h4 className="font-semibold">{tx.categoryName || "Uncategorized"}</h4>
                    <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.date), "MMM d, h:mm a")} • {tx.paymentMethod}
                    </p>
                    {tx.note && <p className="text-xs text-muted-foreground/70 italic mt-0.5 max-w-[200px] truncate">{tx.note}</p>}
                  </div>
                </div>
                <div className="font-mono font-medium text-lg">
                  -{currency}{Number(tx.amount).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}
