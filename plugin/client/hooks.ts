import { useRpc } from "@getpaseo/plugin/client";
import { useToast } from "@getpaseo/plugin/client/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  logsRpc,
  restartRpc,
  startRpc,
  statusRpc,
  stopRpc,
  type ConsoleActionResult,
  type ConsoleStatus,
} from "../shared/console";

const STATUS_KEY = ["bmad-console", "status"] as const;

export function useConsoleStatus() {
  const status = useRpc(statusRpc);
  return useQuery({ queryKey: STATUS_KEY, queryFn: () => status({}), refetchInterval: 2000 });
}

/** Loaded once for the line count; refetch() when the logs are opened. No polling. */
export function useConsoleLogs() {
  const logs = useRpc(logsRpc);
  return useQuery({ queryKey: ["bmad-console", "logs"], queryFn: () => logs({ lines: 300 }) });
}

export function useConsoleActions() {
  const client = useQueryClient();
  const toast = useToast();
  const start = useRpc(startRpc);
  const stop = useRpc(stopRpc);
  const restart = useRpc(restartRpc);

  function build(call: () => Promise<ConsoleActionResult>) {
    return {
      mutationFn: async () => {
        const result = await call();
        client.setQueryData<ConsoleStatus>(STATUS_KEY, result.status);
        if (!result.ok) throw new Error(result.error ?? "The action failed.");
      },
      onError: (error: unknown) => {
        toast.error(error instanceof Error ? error.message : String(error));
        void client.invalidateQueries({ queryKey: STATUS_KEY });
      },
    };
  }

  return {
    start: useMutation(build(() => start({}))),
    stop: useMutation(build(() => stop({}))),
    restart: useMutation(build(() => restart({}))),
  };
}
