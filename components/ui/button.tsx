import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-normal text-wrap text-center sm:whitespace-nowrap rounded-full text-sm font-semibold tracking-[0.08em] uppercase transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/70 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent)] text-[var(--on-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-[var(--accent-bright)] hover:shadow-[var(--shadow-soft)]",
        outline:
          "border border-[var(--border-strong)] bg-transparent text-ink hover:border-[var(--accent)] hover:text-[var(--accent)]",
        ghost: "text-ink hover:bg-[var(--hover)] hover:text-[var(--accent)]",
        dark: "bg-[var(--accent-dim)] text-[var(--on-accent)] hover:bg-[var(--accent)]",
        danger: "border border-[var(--border-strong)] text-[var(--muted)] hover:text-ink hover:border-[var(--text)]",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-7 text-[13px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
