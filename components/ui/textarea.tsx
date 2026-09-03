import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-28 w-full rounded-md border border-brand/14 bg-surface px-4 py-3 text-base text-brand md:text-sm outline-none placeholder:text-brand/42 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/10",
        className,
      )}
      {...props}
    />
  );
}
