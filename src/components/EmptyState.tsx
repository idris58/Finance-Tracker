import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  title: string;
  hint: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  icon?: ReactNode;
};

export function EmptyState({
  title,
  hint,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-center">
      {icon && <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-background">{icon}</div>}
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      {(primaryActionLabel || secondaryActionLabel) && (
        <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {primaryActionLabel && onPrimaryAction && (
            <Button onClick={onPrimaryAction} className="rounded-full px-6">
              {primaryActionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outline" onClick={onSecondaryAction} className="rounded-full px-6">
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
