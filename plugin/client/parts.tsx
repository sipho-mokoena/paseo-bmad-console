import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { PluginHostProps } from "@getpaseo/plugin/client";
import { useStyles } from "./theme";

type Theme = PluginHostProps["theme"];
type Layout = PluginHostProps["layout"];

export interface ThemeProps {
  theme: Theme;
  layout: Layout;
}

export function Button({
  theme,
  layout,
  label,
  onPress,
  disabled,
  pending,
  primary,
}: ThemeProps & {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  pending?: boolean;
  primary?: boolean;
}) {
  const styles = useStyles(theme, layout);
  const inactive = Boolean(disabled || pending);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: Boolean(pending) }}
      disabled={inactive}
      onPress={onPress}
      style={[primary ? styles.buttonPrimary : styles.button, disabled ? styles.buttonDisabled : null]}
    >
      {pending ? (
        <ActivityIndicator
          size="small"
          color={primary ? theme.colors.accentForeground : theme.colors.foreground}
        />
      ) : null}
      <Text style={primary ? styles.buttonTextPrimary : styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function Dot({ color }: { color: string }) {
  return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />;
}

export function Card({ theme, layout, children }: ThemeProps & { children: ReactNode }) {
  const styles = useStyles(theme, layout);
  return <View style={styles.card}>{children}</View>;
}
