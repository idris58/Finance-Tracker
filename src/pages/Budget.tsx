import { useCategories, useStats, useSettings, useTransactions, useUpdateCategory } from "@/hooks/use-finance";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { CategoryManagementModal } from "@/components/CategoryManagementModal";

export default function BudgetPage() {
  const { data: categories, isLoading: catsLoading } = useCategories();
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: settings } = useSettings();
  const { mutate: updateCategory } = useUpdateCategory();
  const [editingBillId, setEditingBillId] = useState<number | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingValue, setEditingValue] = useState("");
  
  // Get current month's transactions
  const now = useMemo(() => new Date(), []);
  const currentMonth = useMemo(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, [now]);
  const { data: transactions, isLoading: transactionsLoading } = useTransactions({ month: currentMonth });
  
  // Get previous month's transactions
  const prevMonthDate = useMemo(() => new Date(now.getFullYear(), now.getMonth() - 1, 1), [now]);
  const previousMonth = useMemo(() => `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`, [prevMonthDate]);
  const { data: prevTransactions, isLoading: prevTransactionsLoading } = useTransactions({ month: previousMonth });
  
  // Get two months ago transactions
  const twoMonthsAgoDate = useMemo(() => new Date(now.getFullYear(), now.getMonth() - 2, 1), [now]);
  const twoMonthsAgoMonth = useMemo(() => `${twoMonthsAgoDate.getFullYear()}-${String(twoMonthsAgoDate.getMonth() + 1).padStart(2, '0')}`, [twoMonthsAgoDate]);
  const { data: twoMonthsAgoTransactions, isLoading: twoMonthsAgoLoading } = useTransactions({ month: twoMonthsAgoMonth });
  
  const currency = settings?.currencySymbol || "৳";

  // Calculate actual spending per category - MUST be before early return
  const chartData = useMemo(() => {
    if (!categories || !transactions) return [];
    
    // Aggregate spending by category
    const spendingByCategory = new Map<number, number>();
    transactions.forEach(tx => {
      if (tx.categoryId) {
        const current = spendingByCategory.get(tx.categoryId) || 0;
        spendingByCategory.set(tx.categoryId, current + Number(tx.amount));
      }
    });

    return categories.map((cat, index) => {
      const spent = cat.id ? (spendingByCategory.get(cat.id) || 0) : 0;
      return {
        name: cat.name,
        value: spent,
        color: cat.color || `hsl(${index * 45}, 70%, 50%)`,
        limit: Number(cat.monthlyLimit) || 0
      };
    });
  }, [categories, transactions]);

  // Calculate monthly comparison data - MUST be before early return
  const monthlyComparison = useMemo(() => {
    const twoMonthsAgoSpent = twoMonthsAgoTransactions?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;
    const previousSpent = prevTransactions?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;
    const currentSpent = transactions?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;
    const change = previousSpent > 0 ? ((currentSpent - previousSpent) / previousSpent) * 100 : 0;
    
    return {
      current: currentSpent,
      previous: previousSpent,
      twoMonthsAgo: twoMonthsAgoSpent,
      change: change,
      data: [
        {
          month: twoMonthsAgoDate.toLocaleDateString('en-US', { month: 'short' }),
          amount: twoMonthsAgoSpent,
        },
        {
          month: prevMonthDate.toLocaleDateString('en-US', { month: 'short' }),
          amount: previousSpent,
        },
        {
          month: new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-US', { month: 'short' }),
          amount: currentSpent,
        },
      ],
    };
  }, [transactions, prevTransactions, now, prevMonthDate]);

  // Get fixed bills (categories marked as isFixed) - MUST be before early return
  const fixedBills = useMemo(() => {
    if (!categories) return [];
    return categories.filter(cat => cat.isFixed).map(cat => {
      const spent = chartData.find(item => item.name === cat.name)?.value || 0;
      return {
        id: cat.id,
        name: cat.name,
        limit: Number(cat.monthlyLimit) || 0,
        spent: spent,
        color: cat.color,
      };
    });
  }, [categories, chartData]);

  // Now we can do early return after all hooks are called
  if (catsLoading || statsLoading || transactionsLoading || prevTransactionsLoading || twoMonthsAgoLoading) {
    return <div className="space-y-6"><Skeleton className="h-64 w-full bg-muted/20 rounded-3xl" /><Skeleton className="h-96 w-full bg-muted/20 rounded-3xl" /></div>;
  }

  const hasSpendingData = chartData.some(item => item.value > 0);
  const totalSpent = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold font-display">Budget & Analytics</h1>

      {/* Monthly Comparison Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 rounded-3xl border border-white/5 backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/0"
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold">Monthly Spending Comparison</h3>
            <p className="text-sm text-muted-foreground mt-1">Last 3 months trend</p>
          </div>
          {monthlyComparison.change !== 0 && (
            <div className={cn(
              "text-sm font-bold px-4 py-2 rounded-full backdrop-blur-md",
              monthlyComparison.change > 0 ? "bg-destructive/20 text-destructive border border-destructive/30" : "bg-primary/20 text-primary border border-primary/30"
            )}>
              {monthlyComparison.change > 0 ? '↑' : '↓'} {Math.abs(monthlyComparison.change).toFixed(1)}%
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart 
            data={monthlyComparison.data}
            margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis 
              dataKey="month" 
              stroke="rgba(255,255,255,0.4)"
              style={{ fontSize: '13px', fontWeight: '500' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <YAxis 
              stroke="rgba(255,255,255,0.4)"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => `${currency}${(value / 1000).toFixed(0)}k`}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <RechartsTooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(19, 36, 63, 0.95)', 
                borderColor: 'rgba(57, 255, 20, 0.2)', 
                borderRadius: '12px',
                color: '#fff',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
              }}
              cursor={{ fill: 'rgba(57, 255, 20, 0.05)' }}
              formatter={(value: number) => [`${currency}${value.toLocaleString()}`, 'Spending']}
              labelStyle={{ color: '#fff' }}
            />
            <Bar 
              dataKey="amount" 
              fill="hsl(var(--primary))"
              radius={[12, 12, 4, 4]}
              isAnimationActive={true}
              animationDuration={800}
            />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">2 Months Ago</span>
            <span className="text-lg font-bold">{currency}{monthlyComparison.twoMonthsAgo.toLocaleString()}</span>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Last Month</span>
            <span className="text-lg font-bold">{currency}{monthlyComparison.previous.toLocaleString()}</span>
          </div>
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
            <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">This Month</span>
            <span className="text-lg font-bold text-primary">{currency}{monthlyComparison.current.toLocaleString()}</span>
          </div>
        </div>
      </motion.div>

      {/* Fixed Bills Section */}
      {fixedBills.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 rounded-3xl border border-white/5"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span className="text-destructive">📋</span> Fixed Bills
            </h3>
            <span className="text-xs text-muted-foreground">
              These are subtracted from Safe-to-Spend
            </span>
          </div>
          <div className="space-y-3">
            {fixedBills.map((bill, idx) => (
              <motion.div
                key={bill.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-white/5 hover:border-white/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: bill.color }} />
                  <span className="font-medium">{bill.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold cursor-pointer hover:text-primary transition-colors" onClick={() => {
                    if (bill.id) {
                      setEditingBillId(bill.id);
                      setEditingValue(bill.limit.toString());
                    }
                  }}>
                    {editingBillId === bill.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{currency}</span>
                        <Input
                          type="number"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="w-20 h-7 px-2 py-0 text-right font-mono text-sm bg-primary/20 border-primary/50"
                          autoFocus
                          onBlur={() => {
                            const newValue = editingValue;
                            if (newValue && bill.id) {
                              updateCategory({
                                id: bill.id,
                                data: {
                                  monthlyLimit: newValue,
                                },
                              });
                            }
                            setEditingBillId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const newValue = editingValue;
                              if (newValue && bill.id) {
                                updateCategory({
                                  id: bill.id,
                                  data: {
                                    monthlyLimit: newValue,
                                  },
                                });
                              }
                              setEditingBillId(null);
                            }
                            if (e.key === 'Escape') {
                              setEditingBillId(null);
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <>
                        {currency}{bill.spent.toLocaleString()} / {currency}{bill.limit.toLocaleString()}
                      </>
                    )}
                  </div>
                  {bill.limit > 0 && editingBillId !== bill.id && (
                    <div className="text-xs text-muted-foreground">
                      {((bill.spent / bill.limit) * 100).toFixed(0)}% used
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            <div className="pt-2 border-t border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Fixed Bills</span>
                <span className="font-mono font-bold text-destructive">
                  {currency}{fixedBills.reduce((sum, bill) => sum + bill.limit, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-1 glass-card p-6 rounded-3xl border border-white/5 flex flex-col items-center justify-center min-h-[350px]"
        >
          <h3 className="text-lg font-bold mb-4 w-full text-left">Spending Breakdown</h3>
          {!hasSpendingData ? (
            <div className="w-full h-[250px] flex flex-col items-center justify-center text-center">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-muted-foreground text-sm max-w-[200px]">
                No data yet! Add your first expense to see your spending breakdown.
              </p>
            </div>
          ) : (
            <div className="w-full h-[250px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.filter(item => item.value > 0).map((entry, index) => (
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
                  <span className="text-2xl font-bold font-mono">{currency}{totalSpent.toLocaleString()}</span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Categories List */}
        <div className="lg:col-span-2 glass-card p-6 rounded-3xl border border-white/5">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold">Category Budgets</h3>
            <button 
              onClick={() => setShowCategoryModal(true)}
              className="text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
            >
              Manage Categories
            </button>
          </div>

          <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {chartData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">No categories yet. Add categories in Settings to track your budget.</p>
              </div>
            ) : (
              chartData.map((item, idx) => {
               const percent = item.limit > 0 ? (item.value / item.limit) * 100 : 0;
               let statusColor = "bg-primary"; // Green (< 50%)
               if (percent >= 80 && percent <= 100) statusColor = "bg-secondary"; // Yellow (80%)
               if (percent > 100) statusColor = "bg-destructive"; // Red (> 100%)

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
            })
            )}
          </div>
        </div>
      </div>

      <CategoryManagementModal 
        open={showCategoryModal}
        onOpenChange={setShowCategoryModal}
      />
    </div>
  );
}
