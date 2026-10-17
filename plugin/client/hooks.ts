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
const LOGS_KEY = ["bmad-console", "logs"] as const;

export function useConsoleStatus() {
  const status = useRpc(statusRpc);
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => status({}),
    refetchInterval: 2000,
  });
}

export function useConsoleLogs(enabled: boolean) {
  const logs = useRpc(logsRpc);
  return useQuery({
    queryKey: LOGS_KEY,
    queryFn: () => logs({ lines: 300 }),
    enabled,
    refetchInterval: enabled ? 3000 : false,
  });
}

export function useConsoleActions() {
  const client = useQueryClient();
  const toast = useToast();
  const start = useRpc(startRpc);
  const stop = useRpc(stopRpc);
  const restart = useRpc(restartRpc);

  function build(call: () => Promise<ConsoleActionResult>, success: string) {
    return {
      mutationFn: async () => {
        const result = await call();
        client.setQueryData<ConsoleStatus>(STATUS_KEY, result.status);
        if (!result.ok) throw new Error(result.error ?? "The action failed.");
        return result;
      },
      onSuccess: (result: ConsoleActionResult) => {
        toast.show(result.alreadyRunning && success === "Starting" ? "Already running" : success, {
          variant: "success",
        });
        void client.invalidateQueries({ queryKey: LOGS_KEY });
      },
      onError: (error: unknown) => {
        toast.error(error instanceof Error ? error.message : String(error));
        void client.invalidateQueries({ queryKey: STATUS_KEY });
      },
    };
  }

  return {
    start: useMutation(build(() => start({}), "Starting")),
    stop: useMutation(build(() => stop({}), "Stopped")),
    restart: useMutation(build(() => restart({}), "Restarting")),
  };
}
