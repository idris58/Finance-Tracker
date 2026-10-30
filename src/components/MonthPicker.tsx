import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface MonthPickerProps {
  value: Date | string;
  onChange: (value: any) => void;
  allowAll?: boolean;
  className?: string;
  align?: "start" | "center" | "end";
}

export function MonthPicker({
  value,
  onChange,
  allowAll = false,
  className,
  align = "start",
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

  const getDisplayText = () => {
    if (value === "all") return "All months";
    if (value instanceof Date) return format(value, "MMMM yyyy");
    if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) {
      const [y, m] = value.split("-").map(Number);
      return format(new Date(y, m - 1, 1), "MMMM yyyy");
    }
    return "Select month";
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
          variant="outline"
          className={cn("rounded-full border-border/60 bg-card/70 px-4", className)}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {getDisplayText()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align={align}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setPickerYear((prev) => prev - 1)}
            aria-label="Previous year"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-semibold">{pickerYear}</div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
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
                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground font-semibold"
                    : "border-border/60 bg-card/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
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
              className="rounded-full text-xs"
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

