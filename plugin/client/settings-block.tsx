import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useSettings } from "@getpaseo/plugin/client";
import { useToast } from "@getpaseo/plugin/client/react-native";
import {
  SettingsAction,
  SettingsCard,
  SettingsGroup,
  SettingsInput,
  SettingsSelect,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import {
  consoleSettings,
  NO_LOGIN_WARNING,
  validateSettings,
  type ConsoleSettingsValues,
} from "../shared/console";
import type { ThemeProps } from "./parts";
import { useStyles } from "./theme";

const MODES = [
  { label: "dev (next dev)", value: "dev" },
  { label: "start (next start, needs pnpm build)", value: "start" },
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
  values,
  revision,
  saving,
  saveError,
  save,
}: ThemeProps & {
  values: ConsoleSettingsValues;
  revision: string;
  saving: boolean;
  saveError: string | null;
  save: (values: ConsoleSettingsValues, revision: string) => Promise<boolean>;
}) {
  const styles = useStyles(theme, layout);
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [generation, setGeneration] = useState(0);

  const current = draft?.values ?? values;
  const portText = draft?.portText ?? String(values.port);
  const errors = validateSettings(current);
  const hasErrors = Object.keys(errors).length > 0;

  const change = useCallback(
    (patch: Partial<ConsoleSettingsValues>, nextPortText?: string) => {
      setDraft((existing) => {
        const base = existing ?? { values, revision, portText: String(values.port) };
        return {
          ...base,
          values: { ...base.values, ...patch },
          portText: nextPortText ?? base.portText,
        };
      });
    },
    [values, revision],
  );

  async function onSave() {
    if (!draft || hasErrors) return;
    const next: ConsoleSettingsValues = {
      ...draft.values,
      consoleDirectory: draft.values.consoleDirectory.trim(),
      bindHost: draft.values.bindHost.trim(),
      publicUrl: draft.values.publicUrl.trim(),
      allowedDevOrigins: draft.values.allowedDevOrigins.trim(),
    };
    if (await save(next, draft.revision)) {
      setDraft(null);
      setGeneration((value) => value + 1);
      toast.show("Settings saved. Restart the console to apply them.", { variant: "success" });
    }
  }

  function onDiscard() {
    setDraft(null);
    setGeneration((value) => value + 1);
  }

  const keyBase = `${generation}-${draft ? draft.revision : revision}`;
  return (
    <SettingsGroup title="Settings">
      <SettingsCard>
        <SettingsInput
          key={`dir-${keyBase}`}
          label="Console directory"
          hint="Absolute path to the paseo-bmad-console checkout."
          placeholder="/home/you/paseo-bmad-console"
          initialValue={current.consoleDirectory}
          error={errors.consoleDirectory}
          disabled={saving}
          onChangeText={(consoleDirectory) => change({ consoleDirectory })}
        />
        <SettingsInput
          key={`port-${keyBase}`}
          label="Port"
          hint="1024 to 65535. Default 3002."
          initialValue={portText}
          error={errors.port}
          disabled={saving}
          onChangeText={(text) => change({ port: text.trim() === "" ? Number.NaN : Number(text) }, text)}
        />
        <SettingsSelect
          label="Mode"
          value={current.mode}
          options={MODES}
          disabled={saving}
          onValueChange={(mode) => change({ mode })}
        />
        <SettingsInput
          key={`host-${keyBase}`}
          label="Bind host"
          hint="Use 127.0.0.1 for this machine only. A phone needs 0.0.0.0 or a Tailscale or LAN address."
          initialValue={current.bindHost}
          error={errors.bindHost}
          disabled={saving}
          onChangeText={(bindHost) => change({ bindHost })}
        />
        <SettingsInput
          key={`public-${keyBase}`}
          label="Public URL"
          hint="Optional. Address other devices use, for example your Tailscale URL."
          placeholder="https://my-machine.tailnet.ts.net:3002"
          initialValue={current.publicUrl}
          error={errors.publicUrl}
          disabled={saving}
          onChangeText={(publicUrl) => change({ publicUrl })}
        />
        <SettingsInput
          key={`origins-${keyBase}`}
          label="Allowed dev origins"
          hint="Optional comma separated host names, passed as ALLOWED_DEV_ORIGINS in dev mode."
          initialValue={current.allowedDevOrigins}
          error={errors.allowedDevOrigins}
          disabled={saving}
          onChangeText={(allowedDevOrigins) => change({ allowedDevOrigins })}
        />
        <SettingsSwitch
          label="Start with Paseo"
          hint="Start the console when the plugin loads."
          value={current.autoStart}
          disabled={saving}
          onValueChange={(autoStart) => change({ autoStart })}
        />
        <SettingsSwitch
          label="No-login mode"
          hint={`${NO_LOGIN_WARNING} Applies to dev mode only; ignored in start mode.`}
          error={errors.noLoginMode}
          value={current.noLoginMode}
          disabled={saving}
          onValueChange={(noLoginMode) => change({ noLoginMode })}
        />
      </SettingsCard>
      {current.noLoginMode ? <Text style={styles.warning}>{NO_LOGIN_WARNING}</Text> : null}
      {saveError ? (
        <Text accessibilityRole="alert" style={styles.danger}>
          {saveError}
        </Text>
      ) : null}
      <SettingsCard>
        <SettingsAction
          label={draft ? "Unsaved changes" : "Settings"}
          actionLabel="Save settings"
          disabled={saving || !draft || hasErrors}
          onPress={() => void onSave()}
        />
        {draft ? (
          <SettingsAction
            label="Discard changes"
            actionLabel="Discard"
            disabled={saving}
            onPress={onDiscard}
          />
        ) : null}
      </SettingsCard>
    </SettingsGroup>
  );
}

export function SettingsBlock({ theme, layout }: ThemeProps) {
  const styles = useStyles(theme, layout);
  const settings = useSettings(consoleSettings);
  if (settings.status === "loading") return <Text style={styles.muted}>Loading settings...</Text>;
  if (settings.status !== "ready") {
    return (
      <SettingsGroup title="Settings">
        <Text style={styles.danger}>{settings.error}</Text>
        <SettingsAction label="Try again" actionLabel="Reload" onPress={() => void settings.reload()} />
        {settings.status === "invalid" ? (
          <SettingsAction
            label="Restore default settings"
            actionLabel="Reset"
            onPress={() => void settings.reset()}
          />
        ) : null}
      </SettingsGroup>
    );
  }
  return (
    <ReadySettings
      theme={theme}
      layout={layout}
      values={settings.values}
      revision={settings.revision}
      saving={settings.saving}
      saveError={settings.saveError}
      save={settings.save}
    />
  );
}
