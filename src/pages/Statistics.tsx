import { useMemo, useState } from "react";
import { format } from "date-fns";
import { BarChart3, CalendarIcon, PieChart as PieIcon } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAccounts, useSettings, useTransactions } from "@/hooks/use-finance";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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

  const monthKey = format(monthDate, "yyyy-MM");
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
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [transactions, activeType]);

  const monthSummary = useMemo(() => {
    const rows: Record<string, { expense: number; income: number; borrow: number; lend: number }> = {};
    (allTransactions || []).forEach((tx) => {
      const key = format(new Date(tx.date), "yyyy-MM");
      if (!rows[key]) rows[key] = { expense: 0, income: 0, borrow: 0, lend: 0 };
      if ((tx.type || "expense") === "expense") rows[key].expense += Number(tx.amount);
      if (tx.type === "income") rows[key].income += Number(tx.amount);
      if (tx.type === "loan" && tx.loanType === "borrow") rows[key].borrow += Number(tx.amount);
      if (tx.type === "loan" && tx.loanType === "lend") rows[key].lend += Number(tx.amount);
    });
    return Object.entries(rows)
      .map(([month, value]) => ({
        month,
        ...value,
        balance: value.income - value.expense + value.borrow - value.lend,
      }))
      .sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [allTransactions]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card/60 to-card/90 p-6">
        <Sheet>
          <SheetTrigger asChild>
            <button className="w-full text-left">
              <p className="text-sm text-muted-foreground">Total balance</p>
              <div className="mt-2 flex items-center gap-2">
                <h2 className="text-3xl font-semibold">{currency}{totalBalance.toLocaleString()}</h2>
                <span className="text-muted-foreground">?</span>
              </div>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh] rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>Monthly balance overview</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              {monthSummary.length === 0 && (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              )}
              {monthSummary.map((row) => (
                <div key={row.month} className="rounded-2xl border border-border/60 bg-card/80 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{format(new Date(`${row.month}-01`), "MMMM yyyy")}</span>
                    <span className="font-semibold">{currency}{row.balance.toLocaleString()}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Expense: {currency}{row.expense.toLocaleString()}</span>
                    <span>Income: {currency}{row.income.toLocaleString()}</span>
                    <span>Borrow: {currency}{row.borrow.toLocaleString()}</span>
                    <span>Lend: {currency}{row.lend.toLocaleString()}</span>
                  </div>
                </div>
              ))}
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

      <div className="flex items-center justify-between">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="rounded-full border-border/60 bg-card/70 px-4">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(monthDate, "MMMM yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={monthDate}
              onSelect={(date) => date && setMonthDate(date)}
              initialFocus
            />
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
          <p className="text-sm text-muted-foreground">No data for this month.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === "bar" ? (
                <BarChart data={categoryTotals} barSize={32}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: number) => `${currency}${value}`} />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                    {categoryTotals.map((entry, index) => (
                      <Cell key={`cell-${entry.name}`} fill={palette[index % palette.length]} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <PieChart>
                  <Tooltip formatter={(value: number) => `${currency}${value}`} />
                  <Pie data={categoryTotals} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                    {categoryTotals.map((entry, index) => (
                      <Cell key={`cell-${entry.name}`} fill={palette[index % palette.length]} />
                    ))}
                  </Pie>
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {categoryTotals.map((item, index) => (
          <div key={item.name} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/80 p-4">
            <div className="flex items-center gap-3">
              <span className="h-9 w-9 rounded-xl" style={{ backgroundColor: palette[index % palette.length] }} />
              <span className="font-medium">{item.name}</span>
            </div>
            <span className="font-semibold">{currency}{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

