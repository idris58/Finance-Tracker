import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface MonthPickerProps {
  value: Date | string;
  onChange: (value: any) => void;
  allowAll?: boolean;
  className?: string;
  align?: "start" | "center" | "end";
  variant?: "outline" | "ghost" | "secondary" | "default";
  formatStyle?: "auto" | "full" | "short";
}

export function MonthPicker({
  value,
  onChange,
  allowAll = false,
  className,
  align = "start",
  variant = "outline",
  formatStyle = "auto",
}: MonthPickerProps) {
  const [open, setOpen] = useState(false);

  const getYear = () => {
    if (value instanceof Date) return value.getFullYear();
    if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) {
      return Number(value.split("-")[0]);
    }
    return new Date().getFullYear();
  };

  const [pickerYear, setPickerYear] = useState<number>(getYear);

  useEffect(() => {
    setPickerYear(getYear());
  }, [value]);

  const getFullDisplayText = () => {
    if (value === "all") return "All months";
    if (value instanceof Date) return format(value, "MMMM yyyy");
    if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) {
      const [y, m] = value.split("-").map(Number);
      return format(new Date(y, m - 1, 1), "MMMM yyyy");
    }
    return "Select month";
  };

  const getShortDisplayText = () => {
    if (value === "all") return "All";
    if (value instanceof Date) return format(value, "MMM yyyy");
    if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) {
      const [y, m] = value.split("-").map(Number);
      return format(new Date(y, m - 1, 1), "MMM yyyy");
    }
    return "Select";
  };

  const handleSelect = (idx: number) => {
    if (value instanceof Date) {
      onChange(new Date(pickerYear, idx, 1));
    } else {
      const monthStr = `${pickerYear}-${String(idx + 1).padStart(2, "0")}`;
      onChange(monthStr);
    }
    setOpen(false);
  };

  const isMonthActive = (idx: number) => {
    if (value === "all") return false;
    if (value instanceof Date) {
      return value.getFullYear() === pickerYear && value.getMonth() === idx;
    }
    if (typeof value === "string") {
      const monthStr = `${pickerYear}-${String(idx + 1).padStart(2, "0")}`;
      return value === monthStr;
    }
    return false;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size="sm"
          className={cn(
            "group flex items-center gap-1.5 h-8.5 rounded-full border border-border/60 bg-background/70 hover:bg-background/95 hover:border-primary/40 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-foreground/90 hover:text-foreground shadow-xs backdrop-blur-md transition-all duration-200",
            className
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 text-primary/80 group-hover:text-primary transition-colors shrink-0" />
          {formatStyle === "full" ? (
            <span>{getFullDisplayText()}</span>
          ) : formatStyle === "short" ? (
            <span>{getShortDisplayText()}</span>
          ) : (
            <>
              <span className="hidden sm:inline">{getFullDisplayText()}</span>
              <span className="sm:hidden">{getShortDisplayText()}</span>
            </>
          )}
          <ChevronDown
            className={cn(
              "h-3 w-3 text-muted-foreground/70 group-hover:text-foreground transition-transform duration-200 shrink-0",
              open && "rotate-180 text-primary"
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-4 rounded-3xl border border-border/70 bg-card/95 backdrop-blur-xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] z-50"
        align={align}
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={() => setPickerYear((prev) => prev - 1)}
            aria-label="Previous year"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-semibold tracking-tight">{pickerYear}</div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={() => setPickerYear((prev) => prev + 1)}
            aria-label="Next year"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, idx) => {
            const monthLabel = format(new Date(2020, idx, 1), "MMM");
            const active = isMonthActive(idx);
            return (
              <button
                key={monthLabel}
                type="button"
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                  active
                    ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "border-border/50 bg-background/40 text-muted-foreground hover:border-primary/40 hover:bg-background/80 hover:text-foreground"
                )}
                onClick={() => handleSelect(idx)}
              >
                {monthLabel}
              </button>
            );
          })}
        </div>
        {allowAll && (
          <div className="mt-3 flex justify-end border-t border-border/40 pt-2">
            <Button
              variant={value === "all" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-full text-xs font-medium"
              onClick={() => {
                onChange("all");
                setOpen(false);
              }}
            >
              All months
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
