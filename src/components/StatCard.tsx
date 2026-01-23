import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  icon?: ReactNode;
  variant?: "default" | "primary" | "secondary" | "danger";
  className?: string;
}

export function StatCard({ label, value, subtext, icon, variant = "default", className }: StatCardProps) {
  const variants = {
    default: "bg-card border-white/5",
    primary: "bg-primary/10 border-primary/20",
    secondary: "bg-secondary/10 border-secondary/20",
    danger: "bg-destructive/10 border-destructive/20"
  };

  const textColors = {
    default: "text-foreground",
    primary: "text-primary",
    secondary: "text-secondary",
    danger: "text-destructive"
  };

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-5 border shadow-lg transition-all hover:translate-y-[-2px]",
      variants[variant],
      className
    )}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">{label}</h3>
        {icon && <div className={cn("p-2 rounded-lg bg-background/50", textColors[variant])}>{icon}</div>}
      </div>
      
      <div className="flex flex-col gap-1">
        <div className={cn("text-2xl md:text-3xl font-bold font-display tracking-tight", textColors[variant])}>
          {value}
        </div>
        {subtext && <p className="text-xs text-muted-foreground/80">{subtext}</p>}
      </div>

      {/* Background decoration */}
      <div className={cn(
        "absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-10 blur-xl",
        variant === "primary" ? "bg-primary" : 
        variant === "secondary" ? "bg-secondary" : 
        variant === "danger" ? "bg-destructive" : "bg-white"
      )} />
    </div>
  );
}
