import { useQuery } from "@tanstack/react-query";
import { getWorkspaceFn } from "@/lib/banking/api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function useWorkspace() {
  const { user, isPending: authPending } = useCurrentUserState();
  const query = useQuery({
    queryKey: ["workspace"],
    queryFn: () => getWorkspaceFn(),
    enabled: Boolean(user),
  });
  return { user, authPending, ...query };
}

export function isUnauthorized(error: unknown) {
  return error instanceof Error && error.message === "Unauthorized";
}
