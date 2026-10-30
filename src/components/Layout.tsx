import { Link, useLocation } from "wouter";
import { Home, BarChart3, WalletCards, Settings, Plus, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TransactionModal } from "./TransactionModal";
import { useTransactionEditor } from "@/components/TransactionEditorProvider";

const baseNavItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: BarChart3, label: "Statistics", href: "/statistics" },
  { icon: List, label: "Transactions", href: "/transactions" },
  { icon: WalletCards, label: "Accounts", href: "/accounts" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { open, setOpen, openNew, transaction, initialType } = useTransactionEditor();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5 transition hover:opacity-85">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <WalletCards className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight text-base">Finance Tracker</span>
          </Link>

          <Link href="/settings">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-full transition-colors",
                location === "/settings"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 md:pb-[calc(env(safe-area-inset-bottom)+2.5rem)] md:pt-8">
        {children}
      </main>

      {/* Balanced 5-Column Bottom Navigation Bar */}
      <nav className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-1/2 z-50 w-[94%] max-w-md -translate-x-1/2 rounded-3xl border border-border/60 bg-card/90 px-3 py-3 shadow-[0_18px_50px_-35px_rgba(0,0,0,0.6)] backdrop-blur-md">
        <div className="grid grid-cols-5 items-center">
          {baseNavItems.slice(0, 2).map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex flex-col items-center gap-1 text-xs font-medium transition-colors",
                  location === item.href ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", location === item.href && "drop-shadow-[0_6px_18px_rgba(244,63,94,0.45)]")} />
                <span>{item.label}</span>
              </div>
            </Link>
          ))}

          <div className="flex items-center justify-center">
            <button
              onClick={() => openNew()}
              className="-mt-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_16px_35px_-18px_rgba(244,63,94,0.9)] ring-4 ring-background transition-transform hover:-translate-y-1"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>

          {baseNavItems.slice(2).map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex flex-col items-center gap-1 text-xs font-medium transition-colors",
                  location === item.href ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", location === item.href && "drop-shadow-[0_6px_18px_rgba(244,63,94,0.45)]")} />
                <span>{item.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </nav>

      <TransactionModal open={open} onOpenChange={setOpen} transaction={transaction ?? undefined} initialType={initialType} />
    </div>
  );
}
