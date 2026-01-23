import { Link, useLocation } from "wouter";
import { LayoutDashboard, Wallet, PieChart, Settings, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TransactionModal } from "./TransactionModal";
import { useState } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);

  const navItems = [
    { icon: LayoutDashboard, label: "Home", href: "/" },
    { icon: Wallet, label: "Transactions", href: "/transactions" },
    { icon: PieChart, label: "Budget", href: "/budget" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground pb-20 md:pb-0 md:pl-24">
      {/* Desktop Sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-24 flex-col items-center py-8 glass-card z-50 border-r border-white/5">
        <div className="mb-12">
          <div className="w-10 h-10 rounded-full bg-primary neon-glow flex items-center justify-center text-primary-foreground font-bold text-xl font-display">
            F
          </div>
        </div>
        
        <div className="flex flex-col gap-6 w-full px-4">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-2xl transition-all duration-300 cursor-pointer group hover:bg-white/5",
                  location === item.href 
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-6 h-6 transition-transform group-hover:scale-110", location === item.href && "neon-glow")} />
                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-auto">
          <button 
            onClick={() => setIsTxModalOpen(true)}
            className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-110 transition-transform neon-glow"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
        {children}
      </main>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-card border-t border-white/5 px-4 py-3 flex justify-around items-center z-50">
        {/* First two nav items */}
        {navItems.slice(0, 2).map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              className={cn(
                "flex flex-col items-center gap-1 transition-colors cursor-pointer min-w-[60px]",
                location === item.href ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("w-6 h-6", location === item.href && "drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </div>
          </Link>
        ))}
        
        {/* FAB in the middle */}
        <div className="relative -top-8">
          <button 
            onClick={() => setIsTxModalOpen(true)}
            className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all neon-glow"
          >
            <Plus className="w-7 h-7" />
          </button>
        </div>

        {/* Last two nav items */}
        {navItems.slice(2).map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              className={cn(
                "flex flex-col items-center gap-1 transition-colors cursor-pointer min-w-[60px]",
                location === item.href ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("w-6 h-6", location === item.href && "drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </div>
          </Link>
        ))}
      </nav>

      <TransactionModal open={isTxModalOpen} onOpenChange={setIsTxModalOpen} />
    </div>
  );
}
