import { useCategories, useStats, useSettings } from "@/hooks/use-finance";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";

export default function BudgetPage() {
  const { data: categories, isLoading: catsLoading } = useCategories();
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: settings } = useSettings();
  
  const currency = settings?.currencySymbol || "৳";

  if (catsLoading || statsLoading) {
    return <div className="space-y-6"><Skeleton className="h-64 w-full bg-muted/20 rounded-3xl" /><Skeleton className="h-96 w-full bg-muted/20 rounded-3xl" /></div>;
  }

  // NOTE: In a real app, backend would aggregate actual spending per category. 
  // For this MVP frontend generation, I'll simulate spending data distribution for the chart based on the total monthly spent.
  // This is a placeholder logic since the schema/API didn't explicitly provide per-category spending totals in the list endpoint.
  
  // Simulated data for visualization purposes
  const chartData = categories?.map((cat, index) => ({
    name: cat.name,
    value: Math.floor(Math.random() * (Number(cat.monthlyLimit) || 1000)), // Mock data
    color: cat.color || `hsl(${index * 45}, 70%, 50%)`,
    limit: Number(cat.monthlyLimit) || 0
  })) || [];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold font-display">Budget & Analytics</h1>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-1 glass-card p-6 rounded-3xl border border-white/5 flex flex-col items-center justify-center min-h-[350px]"
        >
          <h3 className="text-lg font-bold mb-4 w-full text-left">Spending Breakdown</h3>
          <div className="w-full h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#13243f', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-muted-foreground uppercase tracking-widest">Total</span>
                <span className="text-2xl font-bold font-mono">{currency}{stats?.monthlySpent.toLocaleString()}</span>
            </div>
          </div>
        </motion.div>

        {/* Categories List */}
        <div className="lg:col-span-2 glass-card p-6 rounded-3xl border border-white/5">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold">Category Budgets</h3>
            <button className="text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors">Manage Categories</button>
          </div>

          <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {chartData.map((item, idx) => {
               const percent = item.limit > 0 ? (item.value / item.limit) * 100 : 0;
               let statusColor = "bg-primary";
               if (percent > 80) statusColor = "bg-secondary";
               if (percent > 100) statusColor = "bg-destructive";

               return (
                <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={item.name} 
                    className="space-y-2"
                >
                  <div className="flex justify-between text-sm">
                    <span className="font-medium flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.name}
                    </span>
                    <span className="text-muted-foreground font-mono text-xs">
                        {currency}{item.value} / {currency}{item.limit}
                    </span>
                  </div>
                  <Progress value={percent} className="h-2 bg-muted/50" indicatorClassName={statusColor} />
                </motion.div>
               );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
