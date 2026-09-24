import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-[transform,background-color,opacity] duration-150 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lead",
  {
    variants: {
      variant: {
        primary: "bg-ink text-paper hover:opacity-90",
        secondary: "bg-surface text-ink shadow-card hover:bg-paper",
        ghost: "text-ink hover:bg-surface",
        danger: "bg-danger text-paper hover:opacity-90",
        link: "text-lead underline-offset-4 hover:underline px-0 h-auto active:scale-100",
        soft: "bg-lead-soft text-lead hover:opacity-90",
      },
      size: {
        sm: "h-10 px-3.5 text-sm rounded-full",
        md: "h-12 px-5 text-[15px] rounded-full",
        lg: "h-14 px-6 text-[16px] rounded-full",
        icon: "size-12 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
