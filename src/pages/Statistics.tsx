import { useMemo, useState, useEffect } from "react";
import { format, subMonths } from "date-fns";
import { ArrowDownRight, ArrowUpRight, BarChart3, CalendarIcon, ChevronRight, PieChart as PieIcon, ChevronLeft, Eye, EyeOff } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAccounts, useSettings, useTransactions } from "@/hooks/use-finance";
import { useBalancePrivacy } from "@/hooks/use-balance-privacy";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/category-icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const typeTabs = [
  { id: "expense", label: "Expenses" },
  { id: "income", label: "Income" },
  { id: "loan", label: "Loan" },
] as const;

type TxType = (typeof typeTabs)[number]["id"];

const palette = ["#f97316", "#f43f5e", "#a855f7", "#38bdf8", "#22c55e", "#facc15", "#14b8a6", "#6366f1"];

export default function StatisticsPage() {
  const [activeType, setActiveType] = useState<TxType>("expense");
  const [chartMode, setChartMode] = useState<"bar" | "pie">("bar");
  const [monthDate, setMonthDate] = useState<Date>(new Date());
  const [pickerYear, setPickerYear] = useState<number>(new Date().getFullYear());
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  useEffect(() => {
    setPickerYear(monthDate.getFullYear());
  }, [monthDate]);

  const monthKey = format(monthDate, "yyyy-MM");
  const { hideBalance, toggleHideBalance } = useBalancePrivacy();
  const { data: settings } = useSettings();
  const { data: accounts } = useAccounts();
  const { data: transactions } = useTransactions({ month: monthKey });
  const { data: allTransactions } = useTransactions();

  const currency = settings?.currencySymbol || "$";
  const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance || 0), 0) || 0;

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    (transactions || []).forEach((tx) => {
      const type = tx.type || "expense";
      if (activeType === "loan") {
        if (type !== "loan") return;
      } else if (type !== activeType) {
        return;
      }
      const key = tx.categoryName || "Uncategorized";
      totals[key] = (totals[key] || 0) + Number(tx.amount);
    });
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, activeType]);

  const yearSummary = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const rows: Record<string, { expense: number; income: number; borrow: number; lend: number }> = {};
    let totalExpense = 0;
    let totalIncome = 0;

    (allTransactions || []).forEach((tx) => {
      const txDate = new Date(tx.date);
      if (txDate.getFullYear() !== currentYear) return;

      const key = format(txDate, "yyyy-MM");
      if (!rows[key]) rows[key] = { expense: 0, income: 0, borrow: 0, lend: 0 };
      if ((tx.type || "expense") === "expense") {
        rows[key].expense += Number(tx.amount);
        totalExpense += Number(tx.amount);
      }
      if (tx.type === "income") {
        rows[key].income += Number(tx.amount);
        totalIncome += Number(tx.amount);
      }
      if (tx.type === "loan" && tx.loanType === "borrow") rows[key].borrow += Number(tx.amount);
      if (tx.type === "loan" && tx.loanType === "lend") rows[key].lend += Number(tx.amount);
    });

    const table = Object.entries(rows)
      .map(([month, value]) => ({
        month,
        ...value,
        balance: value.income - value.expense,
      }))
      .sort((a, b) => (a.month < b.month ? 1 : -1));

    return { currentYear, totalExpense, totalIncome, table };
  }, [allTransactions]);

  const monthlyComparison = useMemo(() => {
    const currentKey = format(monthDate, "yyyy-MM");
    const prevKey = format(subMonths(monthDate, 1), "yyyy-MM");
    let currentIncome = 0;
    let currentExpense = 0;
    let prevIncome = 0;
    let prevExpense = 0;

    (allTransactions || []).forEach((tx) => {
      const txMonth = format(new Date(tx.date), "yyyy-MM");
      const type = tx.type || "expense";
      if (txMonth === currentKey) {
        if (type === "income") currentIncome += Number(tx.amount);
        if (type === "expense") currentExpense += Number(tx.amount);
      }
      if (txMonth === prevKey) {
        if (type === "income") prevIncome += Number(tx.amount);
        if (type === "expense") prevExpense += Number(tx.amount);
      }
    });

    return {
      currentKey,
      prevKey,
      income: { current: currentIncome, prev: prevIncome },
      expense: { current: currentExpense, prev: prevExpense },
    };
  }, [allTransactions, monthDate]);

  const renderChange = (current: number, prev: number, invertColors = false) => {
    if (prev === 0) {
      return (
        <span className="text-xs text-muted-foreground">
          {current === 0 ? "No change" : "New"}
        </span>
      );
    }
    const delta = current - prev;
    const percent = Math.abs((delta / prev) * 100);
    const isUp = delta >= 0;
    const color = invertColors
      ? (isUp ? "text-rose-500" : "text-emerald-500")
      : (isUp ? "text-emerald-500" : "text-rose-500");

    return (
      <span className={cn("flex items-center gap-1 text-xs font-semibold", color)}>
        {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {Math.abs(percent).toFixed(0)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card/60 to-card/90 p-6">
        <Sheet>
          <SheetTrigger asChild>
            <button className="w-full text-left">
              <p className="text-sm text-muted-foreground">Total balance</p>
              <div className="mt-2 flex items-center gap-2">
                <h2 className="text-3xl font-semibold">
                  {hideBalance ? "******" : `${currency}${totalBalance.toLocaleString()}`}
                </h2>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleHideBalance();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-background/60 text-muted-foreground"
                >
                  {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Tap for details</p>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh] rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>Balance overview</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/80 p-4">
                <div className="text-sm text-muted-foreground">Year</div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                  {yearSummary.currentYear}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
                  <p className="text-xs text-muted-foreground">Total expense</p>
                  <p className="mt-2 text-lg font-semibold">{currency}{yearSummary.totalExpense.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
                  <p className="text-xs text-muted-foreground">Total income</p>
                  <p className="mt-2 text-lg font-semibold">{currency}{yearSummary.totalIncome.toLocaleString()}</p>
                </div>
              </div>

              {yearSummary.table.length === 0 && (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              )}

              {yearSummary.table.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 text-xs">
                  <div className="divide-y divide-border/60 md:hidden">
                    {yearSummary.table.map((row) => (
                      <div key={row.month} className="space-y-2 px-3 py-3 text-sm">
                        <div className="font-semibold">
                          {format(new Date(`${row.month}-01`), "MMMM")}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <span className="text-muted-foreground">Expense</span>
                          <span className="text-right">{currency}{row.expense.toLocaleString()}</span>
                          <span className="text-muted-foreground">Income</span>
                          <span className="text-right">{currency}{row.income.toLocaleString()}</span>
                          <span className="text-muted-foreground">Lend</span>
                          <span className="text-right">{currency}{row.lend.toLocaleString()}</span>
                          <span className="text-muted-foreground">Borrow</span>
                          <span className="text-right">{currency}{row.borrow.toLocaleString()}</span>
                          <span className="text-muted-foreground">Balance</span>
                          <span className={cn("text-right font-semibold", row.balance < 0 ? "text-rose-500" : "text-emerald-500")}>
                            {currency}{row.balance.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <table className="hidden w-full table-fixed text-sm md:table">
                      <thead>
                        <tr className="border-b border-border/60 bg-secondary/60 text-muted-foreground">
                          <th className="px-3 py-2 text-left font-semibold">Month</th>
                          <th className="px-3 py-2 text-right font-semibold">Expense</th>
                          <th className="px-3 py-2 text-right font-semibold">Income</th>
                          <th className="px-3 py-2 text-right font-semibold">Lend</th>
                          <th className="px-3 py-2 text-right font-semibold">Borrow</th>
                          <th className="px-3 py-2 text-right font-semibold">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yearSummary.table.map((row) => (
                          <tr key={row.month} className="border-b border-border/60 last:border-b-0">
                            <td className="px-3 py-2 font-medium">
                              {format(new Date(`${row.month}-01`), "MMMM")}
                            </td>
                            <td className="px-3 py-2 text-right">{currency}{row.expense.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{currency}{row.income.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{currency}{row.lend.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{currency}{row.borrow.toLocaleString()}</td>
                            <td className={cn("px-3 py-2 text-right", row.balance < 0 ? "text-rose-500" : "text-emerald-500")}>
                              {currency}{row.balance.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex gap-3">
        {typeTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveType(tab.id)}
            className={cn(
              "flex-1 rounded-full border px-4 py-2 text-sm font-semibold transition-all",
              activeType === tab.id
                ? "border-primary/40 bg-primary text-primary-foreground"
                : "border-border/60 bg-card/70 text-muted-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
          <p className="text-xs text-muted-foreground">Income (this month)</p>
          <p className="mt-2 text-lg font-semibold">
            {currency}{monthlyComparison.income.current.toLocaleString()}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Last month: {currency}{monthlyComparison.income.prev.toLocaleString()}</span>
            {renderChange(monthlyComparison.income.current, monthlyComparison.income.prev)}
          </div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
          <p className="text-xs text-muted-foreground">Expense (this month)</p>
          <p className="mt-2 text-lg font-semibold">
            {currency}{monthlyComparison.expense.current.toLocaleString()}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Last month: {currency}{monthlyComparison.expense.prev.toLocaleString()}</span>
            {renderChange(monthlyComparison.expense.current, monthlyComparison.expense.prev, true)}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Popover open={isMonthPickerOpen} onOpenChange={setIsMonthPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="rounded-full border-border/60 bg-card/70 px-4">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(monthDate, "MMMM yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-4" align="start">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground"
                onClick={() => setPickerYear((prev) => prev - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-sm font-semibold">{pickerYear}</div>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground"
                onClick={() => setPickerYear((prev) => prev + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, idx) => {
                const monthLabel = format(new Date(2020, idx, 1), "MMM");
                const isActive = monthDate.getFullYear() === pickerYear && monthDate.getMonth() === idx;
                return (
                  <button
                    key={monthLabel}
                    type="button"
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-card/70 text-muted-foreground hover:border-primary/40"
                    )}
                    onClick={() => {
                      setMonthDate(new Date(pickerYear, idx, 1));
                      setIsMonthPickerOpen(false);
                    }}
                  >
                    {monthLabel}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <button
          onClick={() => setChartMode(chartMode === "bar" ? "pie" : "bar")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/70"
        >
          {chartMode === "bar" ? <PieIcon className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
        </button>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/80 p-4">
        {categoryTotals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-center">
            <p className="text-sm text-muted-foreground">No data for this month.</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Try another month or add a transaction to see insights.
            </p>
            <Button onClick={() => setMonthDate(subMonths(monthDate, 1))} className="mt-4 rounded-full px-6">
              View last month
            </Button>
          </div>
        ) : (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === "bar" ? (
                  <BarChart data={categoryTotals} barSize={32}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: number) => `${currency}${value}`} cursor={false} />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                      {categoryTotals.map((entry, index) => (
                        <Cell key={`cell-${entry.name}`} fill={palette[index % palette.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <PieChart>
                  <Tooltip formatter={(value: number) => `${currency}${value}`} cursor={false} />
                    <Pie
                      data={categoryTotals}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={90}
                      activeShape={false}
                    >
                      {categoryTotals.map((entry, index) => (
                        <Cell key={`cell-${entry.name}`} fill={palette[index % palette.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
              {categoryTotals.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-7 rounded-full" style={{ backgroundColor: palette[index % palette.length] }} />
                  <span className="text-xs">{item.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="space-y-3">
        {categoryTotals.map((item, index) => (
          <div key={item.name} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/80 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background">
                {(() => {
                  const entry = getCategoryIcon(item.name);
                  const Icon = entry.icon;
                  return <Icon className={cn("h-5 w-5", entry.className)} />;
                })()}
              </div>
              <span className="font-medium">{item.name}</span>
            </div>
            <span className="font-semibold">{currency}{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

