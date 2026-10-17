import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View, type ScrollView as NativeScrollView } from "react-native";
import { useSettings, type SettingsState } from "@getpaseo/plugin/client";
import { ScrollView, useToast } from "@getpaseo/plugin/client/react-native";
import {
  SettingsAction,
  SettingsCard,
  SettingsGroup,
  SettingsInput,
  SettingsSelect,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import { consoleSettings, validateSettings, type ConsoleSettingsValues } from "../shared/console";
import { hasUnsavedChanges, normalizeValues, noLoginWarning, type SettingsGroupId } from "./logic";
import { Banner, Button, NavRow, type ThemeProps } from "./ui";
import { useStyles } from "./theme";

export type ConsoleSettingsState = SettingsState<typeof consoleSettings.schema>;

const MODES = [
  { label: "Development (next dev)", value: "dev" },
  { label: "Production (next start, needs a build)", value: "start" },
] as const;

interface Draft {
  values: ConsoleSettingsValues;
  /** Revision the draft started from; a newer save elsewhere makes ours conflict. */
  revision: string;
  portText: string;
}

function ReadySettings({
  theme,
  layout,
  settings,
  values,
  revision,
  focus,
  onBack,
}: ThemeProps & {
  settings: ConsoleSettingsState;
  values: ConsoleSettingsValues;
  revision: string;
  focus: SettingsGroupId | null;
  onBack: (() => void) | null;
}) {
  const styles = useStyles(theme, layout);
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [generation, setGeneration] = useState(0);
  const scroller = useRef<NativeScrollView>(null);
  const offsets = useRef<Partial<Record<SettingsGroupId, number>>>({});

  const current = draft?.values ?? values;
  const portText = draft?.portText ?? String(values.port);
  const errors = validateSettings(current);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = hasUnsavedChanges(values, draft?.values ?? null);
  const saving = settings.saving;

  useEffect(() => {
    if (!focus) return;
    const timer = setTimeout(() => {
      const y = offsets.current[focus];
      if (y !== undefined) scroller.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
    }, 60);
    return () => clearTimeout(timer);
  }, [focus]);

  const change = useCallback(
    (patch: Partial<ConsoleSettingsValues>, nextPortText?: string) => {
      setDraft((existing) => {
        const base = existing ?? { values, revision, portText: String(values.port) };
        return { ...base, values: { ...base.values, ...patch }, portText: nextPortText ?? base.portText };
      });
    },
    [values, revision],
  );

  async function onSave() {
    if (!draft || hasErrors || !dirty) return;
    if (await settings.save(normalizeValues(draft.values), draft.revision)) {
      setDraft(null);
      setGeneration((value) => value + 1);
      toast.show("Settings saved. Restart the console to apply them.", { variant: "success" });
    }
  }

  function onDiscard() {
    setDraft(null);
    setGeneration((value) => value + 1);
  }

  function mark(id: SettingsGroupId) {
    return (event: { nativeEvent: { layout: { y: number } } }) => {
      offsets.current[id] = event.nativeEvent.layout.y;
    };
  }

  const keyBase = `${generation}-${draft ? draft.revision : revision}`;
  const warning = noLoginWarning(current);
  return (
    <View style={styles.screen}>
      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.column, { gap: 20 }]}>
          {onBack ? (
            <View>
              <NavRow theme={theme} layout={layout} icon="ChevronLeft" chevron={null} label="Back to BMAD Console" onPress={onBack} />
              <Text accessibilityRole="header" style={styles.title}>
                Settings
              </Text>
            </View>
          ) : null}

          <View onLayout={mark("console")}>
            <SettingsGroup title="Console">
              <SettingsCard>
                <SettingsInput
                  key={`dir-${keyBase}`}
                  label="Console folder"
                  hint="Where paseo-bmad-console is checked out on this machine."
                  placeholder="/path/to/paseo-bmad-console"
                  initialValue={current.consoleDirectory}
                  error={errors.consoleDirectory}
                  disabled={saving}
                  onChangeText={(consoleDirectory) => change({ consoleDirectory })}
                />
                <SettingsSelect
                  label="Mode"
                  value={current.mode}
                  options={MODES}
                  disabled={saving}
                  onValueChange={(mode) => change({ mode })}
                />
              </SettingsCard>
            </SettingsGroup>
          </View>

          <View onLayout={mark("network")}>
            <SettingsGroup title="Network">
              <SettingsCard>
                <SettingsInput
                  key={`port-${keyBase}`}
                  label="Port"
                  hint="1024 to 65535. Default 3002."
                  initialValue={portText}
                  error={errors.port}
                  disabled={saving}
                  onChangeText={(text) => change({ port: text.trim() === "" ? Number.NaN : Number(text) }, text)}
                />
                <SettingsInput
                  key={`host-${keyBase}`}
                  label="Bind host"
                  hint="127.0.0.1 keeps it on this machine. A phone needs 0.0.0.0 or your Tailscale or LAN address."
                  initialValue={current.bindHost}
                  error={errors.bindHost}
                  disabled={saving}
                  onChangeText={(bindHost) => change({ bindHost })}
                />
                <SettingsInput
                  key={`public-${keyBase}`}
                  label="Public URL"
                  hint="Optional. The address your other devices use, for example your Tailscale URL."
                  placeholder="https://my-machine.tailnet.ts.net:3002"
                  initialValue={current.publicUrl}
                  error={errors.publicUrl}
                  disabled={saving}
                  onChangeText={(publicUrl) => change({ publicUrl })}
                />
                <SettingsInput
                  key={`origins-${keyBase}`}
                  label="Allowed dev origins"
                  hint="Optional. Comma separated host names allowed to load the dev server."
                  placeholder="my-machine.tailnet.ts.net"
                  initialValue={current.allowedDevOrigins}
                  error={errors.allowedDevOrigins}
                  disabled={saving}
                  onChangeText={(allowedDevOrigins) => change({ allowedDevOrigins })}
                />
              </SettingsCard>
            </SettingsGroup>
          </View>

          <View onLayout={mark("behavior")}>
            <SettingsGroup title="Behavior">
              <SettingsCard>
                <SettingsSwitch
                  label="Start with Paseo"
                  hint="Start the console when Paseo starts."
                  value={current.autoStart}
                  disabled={saving}
                  onValueChange={(autoStart) => change({ autoStart })}
                />
              </SettingsCard>
            </SettingsGroup>
          </View>

          <View onLayout={mark("security")}>
            <SettingsGroup title="Security">
              <SettingsCard>
                <SettingsSwitch
                  label="No-login mode"
                  error={errors.noLoginMode}
                  value={current.noLoginMode}
                  disabled={saving}
                  onValueChange={(noLoginMode) => change({ noLoginMode })}
                />
              </SettingsCard>
              <View style={{ paddingTop: 8 }}>
                <Banner theme={theme} layout={layout} tone="warning" text={warning} />
              </View>
            </SettingsGroup>
          </View>
        </View>
      </ScrollView>

      {dirty || settings.saveError ? (
        <View style={styles.bar}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={styles.textStrong}>{dirty ? "Unsaved changes" : "Not saved"}</Text>
            {settings.saveError ? (
              <Text accessibilityRole="alert" style={styles.danger} numberOfLines={3}>
                {settings.saveError}
              </Text>
            ) : hasErrors ? (
              <Text style={styles.danger}>Fix the highlighted fields to save.</Text>
            ) : null}
          </View>
          <Button theme={theme} layout={layout} label="Discard" disabled={saving} onPress={onDiscard} />
          <Button
            theme={theme}
            layout={layout}
            variant="primary"
            label="Save changes"
            pending={saving}
            disabled={!dirty || hasErrors}
            onPress={() => void onSave()}
          />
        </View>
      ) : null}
    </View>
  );
}

/** The settings form for a settings state owned by the caller. */
export function SettingsView({
  theme,
  layout,
  settings,
  focus = null,
  onBack = null,
}: ThemeProps & {
  settings: ConsoleSettingsState;
  focus?: SettingsGroupId | null;
  onBack?: (() => void) | null;
}) {
  const styles = useStyles(theme, layout);
  if (settings.status === "loading") {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={styles.muted}>Loading settings...</Text>
      </View>
    );
  }
  if (settings.status !== "ready") {
    return (
      <View style={styles.screen}>
        <View style={[styles.content, styles.column, { gap: 12 }]}>
          <Banner theme={theme} layout={layout} tone="danger" text={settings.error} />
          <SettingsGroup title="Recover">
            <SettingsCard>
              <SettingsAction label="Try again" actionLabel="Reload" onPress={() => void settings.reload()} />
              {settings.status === "invalid" ? (
                <SettingsAction
                  label="Restore default settings"
                  actionLabel="Reset"
                  onPress={() => void settings.reset()}
                />
              ) : null}
            </SettingsCard>
          </SettingsGroup>
        </View>
      </View>
    );
  }
  return (
    <ReadySettings
      theme={theme}
      layout={layout}
      settings={settings}
      values={settings.values}
      revision={settings.revision}
      focus={focus}
      onBack={onBack}
    />
  );
}

/** Settings > Plugins entry: owns its own settings state. */
export function StandaloneSettings({ theme, layout }: ThemeProps) {
  const settings = useSettings(consoleSettings);
  return <SettingsView theme={theme} layout={layout} settings={settings} />;
}
