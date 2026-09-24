import { useEffect, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { checkUsernameFn } from "@/lib/banking/api";
import { validateUsername } from "@/lib/banking/identity";
import { cn } from "@/lib/utils";

export function UsernameField({
  id = "username",
  value,
  onChange,
  hint,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const [status, setStatus] = useState<"idle" | "available" | "taken" | "invalid">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const parsed = validateUsername(value);
    if (!value.trim()) {
      setStatus("idle");
      setMessage(null);
      return;
    }
    if (!parsed.ok) {
      setStatus("invalid");
      setMessage(parsed.error);
      return;
    }
    const t = window.setTimeout(() => {
      void checkUsernameFn({ data: { username: value } })
        .then((r) => {
          setStatus(r.status);
          setMessage(r.message);
        })
        .catch(() => {
          setStatus("idle");
          setMessage(null);
        });
    }, 320);
    return () => window.clearTimeout(t);
  }, [value]);

  return (
    <Field label="Username" htmlFor={id} hint={status === "idle" ? hint : undefined} error={status === "invalid" || status === "taken" ? (message ?? undefined) : undefined}>
      <Input
        id={id}
        autoComplete="username"
        required
        minLength={3}
        maxLength={20}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {status === "available" ? (
        <p className={cn("text-sm text-ok")} role="status">
          Available
        </p>
      ) : null}
    </Field>
  );
}
