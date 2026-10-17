import type { PluginScreenProps, PluginSurfaceProps, PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { ConsolePage } from "./console-page";

export function MainScreen({ theme, navigation, params }: PluginScreenProps) {
  return (
    <ConsolePage
      theme={theme}
      navigation={navigation}
      workspaceId={params.workspaceId ? params.workspaceId : null}
      autoOpen={params.autoOpen === "1"}
    />
  );
}

export function WorkspacePanel({ theme, navigation, workspaceId }: PluginWorkspacePanelProps) {
  return <ConsolePage theme={theme} navigation={navigation} workspaceId={workspaceId} />;
}

/** Registered under Settings > Plugins. */
export function SettingsScreen({ theme, navigation }: PluginSurfaceProps) {
  return <ConsolePage theme={theme} navigation={navigation} workspaceId={null} />;
}
