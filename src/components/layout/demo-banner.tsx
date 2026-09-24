import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/use-workspace";
import { publicProgramFn } from "@/lib/banking/api";
import { DEFAULT_STATUS_LINE, PROGRAM_SUMMARY, PROGRAM_TITLE, programStatusLine } from "@/lib/banking/program";

export function DemoBanner() {
  const { data } = useWorkspace();
  const publicProgram = useQuery({
    queryKey: ["public-program"],
    queryFn: () => publicProgramFn(),
    enabled: !data?.banking,
    staleTime: 60_000,
  });
  const line = data?.banking
    ? programStatusLine(data.banking)
    : (publicProgram.data?.statusLine ?? DEFAULT_STATUS_LINE);
  return (
    <div className="border-b border-line bg-lead-soft px-4 py-3 text-center">
      <p className="text-xs font-medium tracking-[0.18em] text-lead">{PROGRAM_TITLE}</p>
      <p className="mx-auto mt-1 max-w-xl text-sm leading-relaxed text-ink">{PROGRAM_SUMMARY}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{line}</p>
    </div>
  );
}
