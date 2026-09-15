import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-opacity transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-cloth text-cloth-fg hover:opacity-90",
        secondary: "bg-elevated text-ink border border-rule hover:border-rule-strong",
        outline: "border border-rule bg-transparent text-ink hover:bg-elevated",
        ghost: "text-ink hover:bg-elevated",
        stamp: "bg-stamp text-stamp-fg hover:opacity-90",
        good: "bg-good text-good-fg hover:opacity-90",
      },
      size: {
        sm: "h-9 rounded-sm px-3 text-sm",
        md: "h-11 rounded-md px-4 text-sm",
        lg: "h-14 rounded-lg px-5 text-base",
        xl: "h-16 rounded-lg px-6 text-lg",
        icon: "size-11 rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
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
