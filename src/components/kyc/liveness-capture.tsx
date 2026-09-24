import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { kycSubmitSelfieFn } from "@/lib/banking/api";
import { cn } from "@/lib/utils";

const PROMPTS = [
  "Position your face inside the frame.",
  "Keep your face visible.",
  "Turn your head slowly to the left.",
  "Turn your head slowly to the right.",
  "Look straight ahead and follow the movement shown on screen.",
];

export function LivenessCapture({
  configured,
  onDone,
}: {
  configured: boolean;
  onDone: () => Promise<void> | void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [promptIndex, setPromptIndex] = useState(0);
  const [camera, setCamera] = useState<"idle" | "on" | "denied" | "unsupported">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCamera("on");
    } catch {
      setCamera("denied");
    }
  }

  async function submitSession() {
    setBusy(true);
    setError(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const r = await kycSubmitSelfieFn();
    setBusy(false);
    if (r && "ok" in r && r.ok === false) setError(r.error);
    else {
      setFinished(true);
      await onDone();
    }
  }

  if (!configured) {
    return (
      <div className="rounded-2xl bg-warn-soft p-4">
        <p className="text-sm font-medium text-ink">Verification isn’t ready yet</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Face verification needs the identity partner to be connected. We won’t simulate a match. Please try again shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">
        Position your face inside the frame and follow the prompts. The verification result comes from the identity partner — we don’t invent a match. Images are not stored in MONEYLEAD.
      </p>
      <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-3xl bg-ink">
        <video ref={videoRef} className="size-full object-cover" playsInline muted autoPlay />
        <div className="pointer-events-none absolute inset-8 rounded-full face-frame" />
        {camera !== "on" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/70 p-6 text-center">
            <p className="text-sm text-paper">
              {camera === "denied"
                ? "Camera permission was denied. Enable the camera to continue — we won’t skip this step."
                : camera === "unsupported"
                  ? "This browser doesn’t have a camera we can use. Try another device."
                  : "Start the camera to begin."}
            </p>
          </div>
        ) : null}
      </div>
      {camera === "on" ? (
        <div className="rounded-2xl bg-surface p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Step {Math.min(promptIndex + 1, PROMPTS.length)} of {PROMPTS.length}
          </p>
          <p className="mt-2 text-base font-medium text-ink">{PROMPTS[Math.min(promptIndex, PROMPTS.length - 1)]}</p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-ok transition-[width] duration-300"
              style={{ width: `${((promptIndex + 1) / PROMPTS.length) * 100}%` }}
            />
          </div>
        </div>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {camera !== "on" ? (
        <Button className="w-full" size="lg" onClick={() => void startCamera()}>
          Start camera
        </Button>
      ) : promptIndex < PROMPTS.length - 1 ? (
        <Button className="w-full" size="lg" onClick={() => setPromptIndex((i) => i + 1)}>
          Next prompt
        </Button>
      ) : (
        <Button className="w-full" size="lg" disabled={busy || finished} onClick={() => void submitSession()}>
          {busy ? "Verifying identity…" : "Submit for verification"}
        </Button>
      )}
    </div>
  );
}

export function DocumentCapture({
  configured,
  busy,
  onSelect,
}: {
  configured: boolean;
  busy?: boolean;
  onSelect: (type: string) => void;
}) {
  if (!configured) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        Document images are captured during verification. MONEYLEAD records the document type only and will not invent a
        verification result.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted">
        Choose the ID you’ll use. The photo stays on this device for a quality check. It is not a verification decision.
      </p>
      <label className="block">
        <span className="sr-only">Optional quality check photo. Not uploaded.</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className={cn("block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:text-paper")}
        />
      </label>
      <p className="text-xs leading-relaxed text-subtle">
        The photo stays on this device for a quality check. It is not uploaded and is not a verification decision.
      </p>
      <div className="grid gap-2">
        {[
          ["drivers_license", "Driver’s license"],
          ["passport", "Passport"],
          ["state_id", "State ID"],
        ].map(([type, label]) => (
          <Button key={type} variant="secondary" disabled={busy} onClick={() => onSelect(type)}>
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
