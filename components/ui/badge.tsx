import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & { variant?: "default" | "outline" | "verified" | "muted" | "pick" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        variant === "default" && "bg-secondary text-secondary-foreground",
        variant === "outline" && "border border-brand/12 bg-surface text-brand",
        variant === "verified" && "bg-success/12 text-success",
        variant === "muted" && "bg-muted text-muted-foreground",
        variant === "pick" && "bg-brand/8 text-brand",
        className,
      )}
      {...props}
    />
  );
}
