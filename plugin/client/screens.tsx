import type {
  PluginScreenProps,
  PluginSurfaceProps,
  PluginWorkspacePanelProps,
} from "@getpaseo/plugin/client";
import { ConsoleView } from "./console-view";
import { StandaloneSettings } from "./settings-view";

export function MainScreen({ theme, layout, navigation, params }: PluginScreenProps) {
  return (
    <ConsoleView
      theme={theme}
      layout={layout}
      navigation={navigation}
      workspaceId={params.workspaceId ? params.workspaceId : null}
      autoOpen={params.autoOpen === "1"}
    />
  );
}

/** Same view in a compact form: status, actions and the main address. */
export function WorkspacePanel({ theme, layout, navigation, workspaceId }: PluginWorkspacePanelProps) {
  return <ConsoleView theme={theme} layout={layout} navigation={navigation} workspaceId={workspaceId} compact />;
}

/** Registered under Settings > Plugins. */
export function SettingsScreen({ theme, layout }: PluginSurfaceProps) {
  return <StandaloneSettings theme={theme} layout={layout} />;
}
