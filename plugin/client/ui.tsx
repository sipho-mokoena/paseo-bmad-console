import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { ExternalLink } from "@getpaseo/plugin/client/ui";
import { toneColor, useStyles, type ThemeProps } from "./theme";
import type { PillTone } from "./logic";

export type { ThemeProps };

type Variant = "primary" | "secondary" | "ghost";

function useButtonLook(props: ThemeProps & { variant: Variant; disabled?: boolean }) {
  const styles = useStyles(props.theme, props.layout);
  const style =
    props.variant === "primary" ? styles.buttonPrimary : props.variant === "ghost" ? styles.buttonGhost : styles.button;
  const textStyle = props.variant === "primary" ? styles.buttonTextPrimary : styles.buttonText;
  const color = props.variant === "primary" ? props.theme.colors.accentForeground : props.theme.colors.foreground;
  return { style: [style, props.disabled ? styles.buttonDisabled : null], textStyle, color };
}

export function Button(
  props: ThemeProps & {
    label: string;
    onPress: () => void;
    variant?: Variant;
    icon?: string;
    disabled?: boolean;
    pending?: boolean;
    hint?: string;
  },
) {
  const variant = props.variant ?? "secondary";
  const inactive = Boolean(props.disabled || props.pending);
  const look = useButtonLook({ ...props, variant, disabled: props.disabled });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityHint={props.hint}
      accessibilityState={{ disabled: inactive, busy: Boolean(props.pending) }}
      disabled={inactive}
      onPress={props.onPress}
      style={look.style}
    >
      {props.pending ? (
        <ActivityIndicator size="small" color={look.color} />
      ) : props.icon ? (
        <Icon name={props.icon} size={16} color={look.color} />
      ) : null}
      <Text style={look.textStyle}>{props.label}</Text>
    </Pressable>
  );
}

/** Looks like a primary or secondary button but opens a URL through the host. */
export function LinkButton(
  props: ThemeProps & { label: string; href: string; variant?: Variant; icon?: string; onError?: (e: unknown) => void },
) {
  const variant = props.variant ?? "secondary";
  const look = useButtonLook({ ...props, variant });
  return (
    <ExternalLink href={props.href} accessibilityLabel={props.label} onError={props.onError}>
      <View style={look.style}>
        {props.icon ? <Icon name={props.icon} size={16} color={look.color} /> : null}
        <Text style={look.textStyle}>{props.label}</Text>
      </View>
    </ExternalLink>
  );
}

export function IconButton({
  theme,
  layout,
  icon,
  label,
  onPress,
}: ThemeProps & { icon: string; label: string; onPress: () => void }) {
  const styles = useStyles(theme, layout);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={[styles.buttonGhost, { paddingHorizontal: 0, width: 44 }]}
    >
      <Icon name={icon} size={18} color={theme.colors.foregroundMuted} />
    </Pressable>
  );
}

/** Link styled as an icon button, for the trailing slot of an address row. */
export function IconLink({
  theme,
  layout,
  icon,
  label,
  href,
}: ThemeProps & { icon: string; label: string; href: string }) {
  const styles = useStyles(theme, layout);
  return (
    <ExternalLink href={href} accessibilityLabel={label}>
      <View style={[styles.buttonGhost, { paddingHorizontal: 0, width: 44 }]}>
        <Icon name={icon} size={18} color={theme.colors.foregroundMuted} />
      </View>
    </ExternalLink>
  );
}

export function StatusPill({ theme, layout, label, tone }: ThemeProps & { label: string; tone: PillTone }) {
  const styles = useStyles(theme, layout);
  return (
    <View accessibilityRole="text" accessibilityLabel={`Status: ${label}`} style={styles.pill}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: toneColor(theme, tone) }} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

/** Small muted title, content, and a hairline above (except the first section). */
export function Section({
  theme,
  layout,
  title,
  trailing,
  children,
  first,
}: ThemeProps & { title?: string; trailing?: ReactNode; children: ReactNode; first?: boolean }) {
  const styles = useStyles(theme, layout);
  return (
    <View>
      {first ? null : <View style={[styles.separator, { marginTop: 4 }]} />}
      <View style={styles.section}>
        {title ? (
          <View style={[styles.row, { minHeight: 0, paddingVertical: 0, justifyContent: "space-between" }]}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {title}
            </Text>
            {trailing}
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

/** A full-width pressable row: icon, label, optional value, chevron. */
export function NavRow({
  theme,
  layout,
  icon,
  label,
  value,
  chevron = "ChevronRight",
  onPress,
  hint,
}: ThemeProps & {
  icon?: string;
  label: string;
  value?: string;
  chevron?: string | null;
  onPress: () => void;
  hint?: string;
}) {
  const styles = useStyles(theme, layout);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={hint}
      onPress={onPress}
      style={styles.row}
    >
      {icon ? <Icon name={icon} size={18} color={theme.colors.foregroundMuted} /> : null}
      <Text style={[styles.text, styles.rowFill]} numberOfLines={2}>
        {label}
      </Text>
      {value ? <Text style={styles.small}>{value}</Text> : null}
      {chevron ? <Icon name={chevron} size={16} color={theme.colors.foregroundMuted} /> : null}
    </Pressable>
  );
}

export function Banner({
  theme,
  layout,
  tone,
  text,
  icon = "TriangleAlert",
}: ThemeProps & { tone: "warning" | "danger"; text: string; icon?: string }) {
  const styles = useStyles(theme, layout);
  const color = tone === "danger" ? theme.colors.statusDanger : theme.colors.statusWarning;
  return (
    <View accessibilityRole="alert" style={tone === "danger" ? styles.dangerRow : styles.warningRow}>
      <Icon name={icon} size={16} color={color} />
      <Text style={[tone === "danger" ? styles.danger : styles.warning, styles.rowFill]}>{text}</Text>
    </View>
  );
}
