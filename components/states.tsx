"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-3xl border border-dashed border-subtle bg-surface/60 px-6 py-12 text-center", className)}>
      <h2 className="font-display text-xl">{title}</h2>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  retry,
  action,
}: {
  title: string;
  description?: string;
  retry?: () => void;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="rounded-3xl border border-destructive/30 bg-surface px-6 py-10 text-center">
      <h2 className="font-display text-xl">{title}</h2>
      {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
      {retry ? (
        <button className="mt-4 text-sm text-brand underline" onClick={retry} type="button">
          Thử lại
        </button>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
