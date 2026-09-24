import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { lookupPostalFn, suggestAddressFn } from "@/lib/banking/api";
import type { AddressSuggestion } from "@/lib/banking/types";
import { cn } from "@/lib/utils";

export type AddressValue = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export function AddressFields({
  value,
  onChange,
}: {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [looking, setLooking] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.line1.trim();
    if (q.length < 4) {
      setSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      setLooking(true);
      void suggestAddressFn({ data: { query: q } })
        .then((r) => setSuggestions(r.suggestions))
        .catch(() => setSuggestions([]))
        .finally(() => setLooking(false));
    }, 280);
    return () => window.clearTimeout(t);
  }, [value.line1]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function onZipBlur() {
    if (value.city && value.state) return;
    const found = await lookupPostalFn({ data: { zip: value.postalCode } }).catch(() => null);
    if (!found) return;
    onChange({
      ...value,
      city: value.city || found.city,
      state: value.state || found.state,
      postalCode: found.postalCode || value.postalCode,
      country: "US",
    });
  }

  function pick(s: AddressSuggestion) {
    onChange({
      ...value,
      line1: s.line1,
      city: s.city,
      state: s.state,
      postalCode: s.postalCode || value.postalCode,
      country: s.country || "US",
    });
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div className="space-y-4">
      <div ref={box} className="relative">
        <Field label="Street address" htmlFor="line1" hint={looking ? "Looking up addresses…" : undefined}>
          <Input
            id="line1"
            autoComplete="street-address"
            required
            value={value.line1}
            onChange={(e) => {
              onChange({ ...value, line1: e.target.value });
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        </Field>
        {open && suggestions.length ? (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl bg-surface py-1 shadow-float">
            {suggestions.map((s) => (
              <li key={s.label}>
                <button
                  type="button"
                  className={cn("flex min-h-11 w-full px-4 py-2 text-left text-sm text-ink hover:bg-paper")}
                  onClick={() => pick(s)}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Field label="Apartment, suite (optional)" htmlFor="line2">
        <Input
          id="line2"
          autoComplete="address-line2"
          value={value.line2}
          onChange={(e) => onChange({ ...value, line2: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-3">
          <Field label="City" htmlFor="city">
            <Input
              id="city"
              autoComplete="address-level2"
              required
              value={value.city}
              onChange={(e) => onChange({ ...value, city: e.target.value })}
            />
          </Field>
        </div>
        <div className="col-span-1">
          <Field label="State" htmlFor="state">
            <Input
              id="state"
              autoComplete="address-level1"
              required
              maxLength={2}
              value={value.state}
              onChange={(e) => onChange({ ...value, state: e.target.value.toUpperCase() })}
            />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="ZIP" htmlFor="zip">
            <Input
              id="zip"
              autoComplete="postal-code"
              required
              value={value.postalCode}
              onChange={(e) => onChange({ ...value, postalCode: e.target.value })}
              onBlur={() => void onZipBlur()}
            />
          </Field>
        </div>
      </div>
      <Field label="Country" htmlFor="country">
        <Input id="country" value="United States" readOnly />
      </Field>
    </div>
  );
}
