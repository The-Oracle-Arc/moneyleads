import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-md border-0 bg-paper px-4 text-[16px] text-ink placeholder:text-subtle shadow-card",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lead",
        className,
      )}
      {...props}
    />
  );
}

export function PasswordInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className={cn("pr-12", className)} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted hover:text-ink"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

export function CodeInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      {...props}
      className={cn("text-center text-xl tracking-[0.2em] tabular", className)}
    />
  );
}


export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-md border-0 bg-paper px-4 py-3 text-[16px] text-ink placeholder:text-subtle shadow-card",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lead",
        className,
      )}
      {...props}
    />
  );
}

export function NativeSelect({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-12 w-full rounded-md border-0 bg-paper px-4 text-[16px] text-ink shadow-card",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lead",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
