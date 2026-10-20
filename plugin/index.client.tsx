import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { MainScreen, SettingsScreen, WorkspacePanel } from "./client/screens";
import { startRpc, statusRpc, stopRpc } from "./shared/console";

function ConsoleItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="ListChecks"
      label="BMAD Console"
      active={currentScreen?.screenId === "main"}
      onPress={() => openScreen({ screenId: "main" })}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: "main", title: "BMAD Console", Component: MainScreen });
  client.addSidebarHeaderItem({ id: "main", title: "BMAD Console", Component: ConsoleItem });
  client.addSettingsScreen({
    id: "console",
    title: "BMAD Console",
    icon: "ListChecks",
    Component: SettingsScreen,
  });
  client.addWorkspacePanel({
    id: "console",
    title: "BMAD Console",
    icon: "ListChecks",
    context: "workspace",
    locations: ["workspace", "explorer"],
    Component: WorkspacePanel,
  });

  client.addCommandCenterItem({
    id: "open-console",
    title: "Open BMAD Console",
    icon: "ListChecks",
    keywords: ["bmad", "console", "dashboard"],
    context: "workspace",
    async onSelect({ rpc, workspace, openScreen }) {
      const status = await rpc(statusRpc, {});
      if (status.state === "stopped" || status.state === "crashed") {
        const started = await rpc(startRpc, {});
        if (!started.ok) throw new Error(started.error ?? "Could not start the BMAD Console.");
      }
      // Commands cannot open a browser tab themselves, only screens and panels can. The
      // screen opens the Paseo browser tab (Electron) once the console answers.
      openScreen({ screenId: "main", params: { workspaceId: workspace.id, autoOpen: "1" } });
    },
  });
  client.addCommandCenterItem({
    id: "toggle-console",
    title: "Start/Stop BMAD Console",
    icon: "Power",
    keywords: ["bmad", "console", "start", "stop"],
    context: "global",
    async onSelect({ rpc }) {
      const status = await rpc(statusRpc, {});
      const owned = status.pid !== null;
      const result = owned ? await rpc(stopRpc, {}) : await rpc(startRpc, {});
      if (!result.ok) throw new Error(result.error ?? "The BMAD Console action failed.");
    },
  });
  return () => {};
}
