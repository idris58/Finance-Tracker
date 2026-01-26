import { Link, useLocation } from "wouter";
import { Home, BarChart3, WalletCards, Settings, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TransactionModal } from "./TransactionModal";
import { useTransactionEditor } from "@/components/TransactionEditorProvider";

const navItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: BarChart3, label: "Statistics", href: "/statistics" },
  { icon: WalletCards, label: "Accounts", href: "/accounts" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { open, setOpen, openNew, transaction } = useTransactionEditor();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:pb-10 md:pt-8">
        {children}
      </main>

      <nav className="fixed bottom-3 left-1/2 z-50 w-[94%] max-w-md -translate-x-1/2 rounded-3xl border border-border/60 bg-card/90 px-3 py-3 shadow-[0_18px_50px_-35px_rgba(0,0,0,0.6)] backdrop-blur-md">
        <div className="grid grid-cols-5 items-center">
          {navItems.slice(0, 2).map((item) => (
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
              onClick={openNew}
              className="-mt-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_16px_35px_-18px_rgba(244,63,94,0.9)] ring-4 ring-background transition-transform hover:-translate-y-1"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>

          {navItems.slice(2).map((item) => (
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

      <TransactionModal open={open} onOpenChange={setOpen} transaction={transaction ?? undefined} />
    </div>
  );
}

