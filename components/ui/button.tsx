import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 min-h-11 px-4 py-2 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-brand text-white hover:bg-brand-hover active:bg-brand-active",
        secondary: "bg-brand-secondary text-brand hover:bg-brand/4",
        outline: "border border-brand/12 bg-transparent text-brand hover:bg-brand/4",
        ghost: "text-brand hover:bg-brand/4",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
        link: "text-brand underline-offset-4 hover:underline px-0",
      },
      size: {
        default: "min-h-11",
        sm: "min-h-9 px-3 text-xs",
        lg: "min-h-12 px-6",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
