import { useMemo } from "react";
import { Platform, type TextStyle, type ViewStyle } from "react-native";
import type { PluginHostProps } from "@getpaseo/plugin/client";
import type { ConsoleState } from "../shared/console";

type Theme = PluginHostProps["theme"];
type Layout = PluginHostProps["layout"];

export const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function useStyles(theme: Theme, layout: Layout) {
  return useMemo(() => {
    const pad = layout.compact ? 12 : 16;
    const gap = layout.compact ? 8 : 12;
    const card: ViewStyle = {
      backgroundColor: theme.colors.surface1,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: pad,
      gap,
    };
    const button: ViewStyle = {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      minHeight: 40,
      paddingHorizontal: pad,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface2,
    };
    return {
      screen: { flex: 1, backgroundColor: theme.colors.surface0 } satisfies ViewStyle,
      content: { padding: pad, gap } satisfies ViewStyle,
      card,
      row: { flexDirection: "row", alignItems: "center", gap } satisfies ViewStyle,
      wrapRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap } satisfies ViewStyle,
      title: { color: theme.colors.foreground, fontSize: layout.compact ? 18 : 20, fontWeight: "600" } satisfies TextStyle,
      sectionTitle: { color: theme.colors.foreground, fontSize: 15, fontWeight: "600" } satisfies TextStyle,
      text: { color: theme.colors.foreground, fontSize: 14 } satisfies TextStyle,
      muted: { color: theme.colors.foregroundMuted, fontSize: 13 } satisfies TextStyle,
      warning: { color: theme.colors.statusWarning, fontSize: 13 } satisfies TextStyle,
      danger: { color: theme.colors.statusDanger, fontSize: 13 } satisfies TextStyle,
      link: { color: theme.colors.accent, fontSize: 14 } satisfies TextStyle,
      button,
      buttonPrimary: {
        ...button,
        backgroundColor: theme.colors.accent,
        borderColor: theme.colors.accent,
      } satisfies ViewStyle,
      buttonDisabled: { opacity: 0.45 } satisfies ViewStyle,
      buttonText: { color: theme.colors.foreground, fontSize: 14 } satisfies TextStyle,
      buttonTextPrimary: { color: theme.colors.accentForeground, fontSize: 14 } satisfies TextStyle,
      mono: {
        color: theme.colors.foreground,
        fontFamily: MONO,
        fontSize: 12,
      } satisfies TextStyle,
      logBox: {
        maxHeight: 280,
        backgroundColor: theme.colors.surface0,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: 8,
        padding: 8,
      } satisfies ViewStyle,
      urlRow: { gap: 4, paddingVertical: 4 } satisfies ViewStyle,
    };
  }, [theme, layout.compact]);
}

export function stateColor(theme: Theme, state: ConsoleState): string {
  switch (state) {
    case "running":
    case "external":
      return theme.colors.statusSuccess;
    case "starting":
    case "stopping":
      return theme.colors.statusWarning;
    case "crashed":
      return theme.colors.statusDanger;
    default:
      return theme.colors.foregroundMuted;
  }
}

export const STATE_LABEL: Record<ConsoleState, string> = {
  not_configured: "Not configured",
  stopped: "Stopped",
  starting: "Starting",
  running: "Running",
  external: "Running (started elsewhere)",
  stopping: "Stopping",
  crashed: "Crashed",
};
