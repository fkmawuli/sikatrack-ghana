import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "gold";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-primary-contrast hover:bg-primary-dark active:bg-primary-dark",
  secondary: "bg-surface text-foreground border border-border hover:bg-background",
  outline: "bg-transparent text-primary border border-primary hover:bg-primary/5",
  ghost: "bg-transparent text-foreground hover:bg-black/5",
  danger: "bg-danger text-white hover:bg-danger/90",
  gold: "bg-gold text-white hover:bg-gold-dark",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5 min-h-[36px]",
  md: "text-base px-4 py-2.5 min-h-[44px]",
  lg: "text-lg px-6 py-3.5 min-h-[52px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", fullWidth, loading, disabled, children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export default Button;
