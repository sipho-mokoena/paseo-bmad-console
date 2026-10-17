import type {
  PluginScreenProps,
  PluginSurfaceProps,
  PluginWorkspacePanelProps,
} from "@getpaseo/plugin/client";
import { ConsoleView } from "./console-view";
import { SettingsBlock } from "./settings-block";

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

export function WorkspacePanel({ theme, layout, navigation, workspaceId }: PluginWorkspacePanelProps) {
  return <ConsoleView theme={theme} layout={layout} navigation={navigation} workspaceId={workspaceId} />;
}

/** Same settings form, registered under Settings > Plugins. */
export function SettingsScreen({ theme, layout }: PluginSurfaceProps) {
  return <SettingsBlock theme={theme} layout={layout} />;
}
