import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]",
  {
    variants: {
      variant: {
        new: "bg-[var(--accent)] text-[var(--on-accent)]",
        offer: "bg-[#FF2D6A] text-white",
        muted: "bg-[var(--hover-strong)] text-[var(--muted)]",
        stock: "bg-[var(--ok-muted)] text-[var(--ok)] border border-[var(--ok-border)]",
        low: "bg-[var(--warn)]/15 text-[var(--warn)] border border-[var(--warn)]/40",
      },
    },
    defaultVariants: { variant: "muted" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
