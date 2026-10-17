import { useMemo } from "react";
import { Platform, type TextStyle, type ViewStyle } from "react-native";
import type { PluginHostProps } from "@getpaseo/plugin/client";
import type { PillTone } from "./logic";

export type Theme = PluginHostProps["theme"];
export type Layout = PluginHostProps["layout"];

export interface ThemeProps {
  theme: Theme;
  layout: Layout;
}

export const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
export const ROW_HEIGHT = 44;
export const RADIUS = 8;

export function toneColor(theme: Theme, tone: PillTone): string {
  switch (tone) {
    case "success":
      return theme.colors.statusSuccess;
    case "warning":
      return theme.colors.statusWarning;
    case "danger":
      return theme.colors.statusDanger;
    default:
      return theme.colors.foregroundMuted;
  }
}

export function useStyles(theme: Theme, layout: Layout) {
  return useMemo(() => {
    const pad = layout.compact ? 16 : 24;
    const c = theme.colors;
    const button: ViewStyle = {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: ROW_HEIGHT,
      minWidth: ROW_HEIGHT,
      paddingHorizontal: 16,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface1,
    };
    return {
      screen: { flex: 1, backgroundColor: c.surface0 } satisfies ViewStyle,
      content: { paddingTop: 20, paddingBottom: 32, paddingHorizontal: pad } satisfies ViewStyle,
      column: { width: "100%", maxWidth: 720, alignSelf: "center" } satisfies ViewStyle,
      header: { gap: 4, paddingBottom: 16 } satisfies ViewStyle,
      headerRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 } satisfies ViewStyle,
      title: { color: c.foreground, fontSize: 18, fontWeight: "600" } satisfies TextStyle,
      subtitle: { color: c.foregroundMuted, fontSize: 13 } satisfies TextStyle,
      pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: c.border,
      } satisfies ViewStyle,
      pillText: { color: c.foreground, fontSize: 12, fontWeight: "500" } satisfies TextStyle,
      section: { paddingTop: 20 } satisfies ViewStyle,
      sectionTitle: {
        color: c.foregroundMuted,
        fontSize: 12,
        fontWeight: "500",
        letterSpacing: 0.4,
        textTransform: "uppercase",
        paddingBottom: 8,
      } satisfies TextStyle,
      separator: { height: 1, backgroundColor: c.border } satisfies ViewStyle,
      row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: ROW_HEIGHT,
        paddingVertical: 6,
      } satisfies ViewStyle,
      rowFill: { flex: 1, minWidth: 0 } satisfies ViewStyle,
      wrapRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 } satisfies ViewStyle,
      text: { color: c.foreground, fontSize: 14 } satisfies TextStyle,
      textStrong: { color: c.foreground, fontSize: 14, fontWeight: "500" } satisfies TextStyle,
      muted: { color: c.foregroundMuted, fontSize: 13, lineHeight: 18 } satisfies TextStyle,
      small: { color: c.foregroundMuted, fontSize: 12 } satisfies TextStyle,
      warning: { color: c.statusWarning, fontSize: 13, lineHeight: 18 } satisfies TextStyle,
      danger: { color: c.statusDanger, fontSize: 13, lineHeight: 18 } satisfies TextStyle,
      button,
      buttonPrimary: { ...button, backgroundColor: c.accent, borderColor: c.accent } satisfies ViewStyle,
      buttonGhost: {
        ...button,
        backgroundColor: "transparent",
        borderColor: "transparent",
        paddingHorizontal: 10,
      } satisfies ViewStyle,
      buttonDisabled: { opacity: 0.5 } satisfies ViewStyle,
      buttonText: { color: c.foreground, fontSize: 14, fontWeight: "500" } satisfies TextStyle,
      buttonTextPrimary: { color: c.accentForeground, fontSize: 14, fontWeight: "500" } satisfies TextStyle,
      mono: { color: c.foreground, fontFamily: MONO, fontSize: 12, lineHeight: 17 } satisfies TextStyle,
      logBox: {
        maxHeight: 260,
        backgroundColor: c.surface1,
        borderColor: c.border,
        borderWidth: 1,
        borderRadius: RADIUS,
        padding: 10,
      } satisfies ViewStyle,
      warningRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        padding: 12,
        borderRadius: RADIUS,
        borderWidth: 1,
        borderColor: c.statusWarning,
      } satisfies ViewStyle,
      dangerRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        padding: 12,
        borderRadius: RADIUS,
        borderWidth: 1,
        borderColor: c.statusDanger,
      } satisfies ViewStyle,
      bar: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: pad,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: c.border,
        backgroundColor: c.surface0,
      } satisfies ViewStyle,
    };
  }, [theme, layout.compact]);
}
