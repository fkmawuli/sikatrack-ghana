import { HTMLAttributes } from "react";
import clsx from "clsx";

type Tone = "primary" | "gold" | "danger" | "warning" | "success" | "neutral";

const toneClasses: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary-dark",
  gold: "bg-gold-light text-gold-dark",
  danger: "bg-danger-light text-danger",
  warning: "bg-warning-light text-warning",
  success: "bg-success-light text-success",
  neutral: "bg-black/5 text-muted",
};

export default function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
