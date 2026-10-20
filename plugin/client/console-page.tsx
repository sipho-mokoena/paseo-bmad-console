import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { usePaseo, useSettings, type PluginScreenProps } from "@getpaseo/plugin/client";
import { Icon, ScrollView, copyText, useToast } from "@getpaseo/plugin/client/react-native";
import {
  ExternalLink,
  SettingsAction,
  SettingsCard,
  SettingsGroup,
  SettingsInput,
  SettingsRow,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import { useQuery } from "@tanstack/react-query";
import { consoleSettings, formatUptime, validateSettings } from "../shared/console";
import { useConsoleActions, useConsoleStatus } from "./hooks";
import {
  actionsFor,
  hasChanges,
  networkChoice,
  normalizeValues,
  pickWorkspace,
  statusChip,
  statusRow,
  type ChipTone,
} from "./logic";

type Theme = PluginScreenProps["theme"];

export interface ConsolePageProps {
  theme: Theme;
  navigation: PluginScreenProps["navigation"];
  /** Workspace the page was opened for; the first workspace is used when null. */
  workspaceId: string | null;
  /** Open the Paseo browser tab once the console answers (set by the Command Center item). */
  autoOpen?: boolean;
}

function toneColor(theme: Theme, tone: ChipTone): string {
  const c = theme.colors;
  return tone === "success" ? c.statusSuccess : tone === "warning" ? c.statusWarning : tone === "danger" ? c.statusDanger : c.foregroundMuted;
}

function Chip({ theme, label, tone, icon }: { theme: Theme; label: string; tone?: ChipTone; icon?: string }) {
  const c = theme.colors;
  const color = tone ? toneColor(theme, tone) : c.foregroundMuted;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface1,
      }}
    >
      {tone ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} /> : null}
      {icon ? <Icon name={icon} size={12} color={c.foregroundMuted} /> : null}
      <Text style={{ color, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

/** Outlined button with an icon, like the buttons in Paseo's own settings rows. */
function ActionButton({
  theme,
  label,
  icon,
  danger = false,
  disabled = false,
  onPress,
}: {
  theme: Theme;
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}>
      <ButtonFace theme={theme} label={label} icon={icon} danger={danger} disabled={disabled} />
    </Pressable>
  );
}

function ButtonFace({
  theme,
  label,
  icon,
  danger = false,
  disabled = false,
}: {
  theme: Theme;
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  const c = theme.colors;
  const color = danger ? c.statusDanger : c.foreground;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.border,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon ? <Icon name={icon} size={16} color={color} /> : null}
      <Text style={{ color, fontSize: 14 }}>{label}</Text>
    </View>
  );
}

/** Amber notice, like the version warning on Paseo's Overview. */
function Banner({ theme, text }: { theme: Theme; text: string }) {
  const c = theme.colors;
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: c.statusWarning }}>
      <Text style={{ color: c.statusWarning, fontSize: 12, lineHeight: 18 }}>{text}</Text>
    </View>
  );
}

export function ConsolePage({ theme, navigation, workspaceId, autoOpen = false }: ConsolePageProps) {
  const c = theme.colors;
  const toast = useToast();
  const paseo = usePaseo();
  const openBrowser = navigation?.openBrowser;
  const statusQuery = useConsoleStatus();
  const actions = useConsoleActions();
  const settings = useSettings(consoleSettings);
  const status = statusQuery.data;

  const [draft, setDraft] = useState<ReturnType<typeof consoleSettings.schema.parse> | null>(null);
  const [portText, setPortText] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState<boolean | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  /** Open the Paseo browser tab as soon as the console answers. */
  const [wantOpen, setWantOpen] = useState(autoOpen);

  const workspaces = useQuery({
    queryKey: ["bmad-console", "workspaces"],
    queryFn: async () => (await paseo.workspaces.list()).entries,
    enabled: openBrowser !== undefined && !workspaceId,
  });
  const targetWorkspace = pickWorkspace(workspaceId, workspaces.data ?? []);
  const browserUrl = status?.urls.local ?? null;
  const reachable = Boolean(status?.reachable);

  function openInPaseo() {
    if (!openBrowser || !targetWorkspace || !browserUrl) return;
    try {
      openBrowser({ url: browserUrl, workspaceId: targetWorkspace });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  useEffect(() => {
    if (!wantOpen || !reachable || !openBrowser || !targetWorkspace || !browserUrl) return;
    setWantOpen(false);
    try {
      openBrowser({ url: browserUrl, workspaceId: targetWorkspace });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }, [wantOpen, reachable, openBrowser, targetWorkspace, browserUrl, toast]);

  async function copy(text: string, done: string) {
    try {
      await copyText(text);
      toast.show(done, { variant: "success" });
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  }

  const busy = actions.start.isPending || actions.stop.isPending || actions.restart.isPending;
  const chip = statusChip(status?.state ?? "not_configured");
  const row = status ? statusRow(status) : null;
  const toShow = status ? actionsFor(status) : null;
  const needsSetup = status ? status.state === "not_configured" || status.configError !== null || status.settingsError !== null : false;
  const showSettings = settingsOpen ?? needsSetup;

  function renderConsole() {
    if (!status || !row || !toShow) return null;
    const crashed = status.state === "crashed";
    const problem = status.settingsError ?? status.configError ?? (crashed ? row.hint : null);
    const uptime = status.state === "running" && status.uptimeSeconds !== null ? `Running for ${formatUptime(status.uptimeSeconds)}` : undefined;
    const hint = problem ? undefined : (uptime ?? row.hint);
    const configured = status.state !== "not_configured";
    return (
      <>
        {problem ? <Banner theme={theme} text={problem} /> : null}
        <SettingsGroup title="Console">
          <SettingsCard>
            <SettingsRow label="Status" hint={hint}>
              <Text style={{ color: c.foregroundMuted, fontSize: 14 }}>{row.value}</Text>
            </SettingsRow>
            {configured ? (
              <SettingsRow
                label="Address"
                hint={status.urls.public ? status.urls.preferred : `${status.urls.preferred}\nTurn on "Open from my phone and other devices" to use it from other devices`}
              >
                <ActionButton theme={theme} label="Copy address" icon="Copy" onPress={() => void copy(status.urls.preferred, "Address copied")} />
              </SettingsRow>
            ) : null}
            <SettingsRow label="Console" hint={reachable ? undefined : "Starts the console, then opens it"}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>
                {reachable && openBrowser ? (
                  <ActionButton theme={theme} label="Open" icon="ExternalLink" disabled={!targetWorkspace} onPress={openInPaseo} />
                ) : null}
                {reachable && !openBrowser ? (
                  <ExternalLink href={status.urls.preferred}>
                    <ButtonFace theme={theme} label="Open in browser" icon="ExternalLink" />
                  </ExternalLink>
                ) : null}
                {!reachable && (toShow.start || status.state === "starting") ? (
                  <ActionButton
                    theme={theme}
                    label={busy || status.state === "starting" ? "Starting..." : openBrowser ? "Start and open" : "Start"}
                    icon="Play"
                    disabled={busy || status.state === "starting" || (toShow.start?.disabled ?? true)}
                    onPress={() => {
                      if (openBrowser) setWantOpen(true);
                      actions.start.mutate();
                    }}
                  />
                ) : null}
                {toShow.restart ? (
                  <ActionButton
                    theme={theme}
                    label="Restart"
                    icon="RotateCw"
                    disabled={busy || toShow.restart.disabled}
                    onPress={() => actions.restart.mutate()}
                  />
                ) : null}
                {toShow.stop ? (
                  <ActionButton theme={theme} label="Stop" icon="Square" danger disabled={busy} onPress={() => actions.stop.mutate()} />
                ) : null}
              </View>
            </SettingsRow>
          </SettingsCard>
        </SettingsGroup>
      </>
    );
  }

  function renderSettings() {
    if (settings.status === "loading") return null;
    if (settings.status !== "ready") {
      return (
        <SettingsGroup title="Settings">
          <SettingsCard>
            <SettingsAction
              label="Settings could not be loaded"
              hint={settings.error}
              actionLabel="Reload"
              onPress={() => void settings.reload()}
            />
            {settings.status === "invalid" ? (
              <SettingsAction label="Restore default settings" actionLabel="Reset" onPress={() => void settings.reset()} />
            ) : null}
          </SettingsCard>
        </SettingsGroup>
      );
    }
    const saved = settings.values;
    const revision = settings.revision;
    type Values = typeof saved;
    const current = draft ?? saved;
    const errors = validateSettings(current);
    const invalid = Object.keys(errors).length > 0;
    const dirty = hasChanges(saved, current);
    const keyBase = revision;
    const change = (patch: Partial<Values>) => setDraft({ ...current, ...patch });
    const sharing = networkChoice(current.bindHost) !== "local";
    const detectedAddress = status?.urls.public ?? null;
    const showAdvanced =
      advancedOpen || Boolean(errors.consoleDirectory || errors.port || errors.publicUrl || errors.bindHost) || (status !== undefined && !status.directory);

    async function save() {
      const ok = await settings.save({ ...normalizeValues(current), lastWorkspaceId: saved.lastWorkspaceId }, revision);
      if (ok) {
        setDraft(null);
        setPortText(null);
        toast.show("Settings saved. Restart the console to apply them.", { variant: "success" });
      } else {
        toast.error("Could not save the settings.");
      }
    }

    return (
      <SettingsGroup
        title="Settings"
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showAdvanced }}
            onPress={() => setAdvancedOpen(!showAdvanced)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Icon name={showAdvanced ? "ChevronUp" : "ChevronDown"} size={14} color={c.foregroundMuted} />
            <Text style={{ color: c.foregroundMuted, fontSize: 12 }}>Advanced settings</Text>
          </Pressable>
        }
      >
        <SettingsCard>
          <SettingsSwitch
            label="Open from my phone and other devices"
            hint={
              sharing
                ? `${detectedAddress ? `Reachable at ${detectedAddress}. ` : ""}There is no login, so use this on a private network such as Tailscale.`
                : "Off: only this machine can open the console."
            }
            value={sharing}
            onValueChange={(on) => change({ bindHost: on ? "0.0.0.0" : "127.0.0.1" })}
          />
          <SettingsSwitch
            label="Start with Paseo"
            hint="Start the console when Paseo starts."
            value={current.autoStart}
            onValueChange={(autoStart) => change({ autoStart })}
          />
          {showAdvanced ? (
            <>
              <SettingsInput
                key={`dir-${keyBase}`}
                label="Console folder"
                hint={
                  current.consoleDirectory.trim() === "" && status?.directory
                    ? "Found automatically. Fill this in only to use a different folder."
                    : "Where paseo-bmad-console is installed on this machine."
                }
                placeholder={status?.directory || "/home/you/paseo-bmad-console"}
                initialValue={current.consoleDirectory}
                error={errors.consoleDirectory}
                onChangeText={(consoleDirectory) => change({ consoleDirectory })}
              />
              <SettingsInput
                key={`port-${keyBase}`}
                label="Port"
                hint="1024 to 65535. Default 7002."
                initialValue={portText ?? String(current.port)}
                error={errors.port}
                onChangeText={(text) => {
                  setPortText(text);
                  change({ port: text.trim() === "" ? Number.NaN : Number(text) });
                }}
              />
              <SettingsInput
                key={`public-${keyBase}`}
                label="Address for other devices"
                hint="Found automatically. Fill this in to use a Tailscale name or another link."
                placeholder={detectedAddress ?? "https://my-machine.tailnet.ts.net:7002"}
                initialValue={current.publicUrl}
                error={errors.publicUrl}
                onChangeText={(publicUrl) => change({ publicUrl })}
              />
              {networkChoice(current.bindHost) === "custom" ? (
                <SettingsInput
                  key={`host-${keyBase}`}
                  label="Listen on"
                  hint="A specific network address of this machine. The switch above resets it."
                  initialValue={current.bindHost}
                  error={errors.bindHost}
                  onChangeText={(bindHost) => change({ bindHost })}
                />
              ) : null}
            </>
          ) : null}
          <SettingsAction
            label="Save changes"
            hint={dirty ? "Restart the console afterwards to apply them." : undefined}
            error={settings.saveError}
            actionLabel="Save"
            disabled={!dirty || invalid || settings.saving}
            onPress={() => void save()}
          />
        </SettingsCard>
      </SettingsGroup>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.surface0 }} contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
      <View style={{ width: "100%", maxWidth: 720, alignSelf: "center", gap: 24 }}>
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="header" style={{ color: c.foreground, fontSize: 28, fontWeight: "600" }}>
            BMAD Console
          </Text>
          {status ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip theme={theme} label={chip.label} tone={chip.tone} />
              {status.state !== "not_configured" ? <Chip theme={theme} label={status.urls.local.replace("http://", "")} icon="Monitor" /> : null}
            </View>
          ) : null}
        </View>

        {statusQuery.isError ? (
          <SettingsGroup title="Console">
            <SettingsCard>
              <SettingsAction
                label="Could not reach the plugin on the Paseo daemon"
                hint="Check that the plugin is running."
                actionLabel="Retry"
                onPress={() => void statusQuery.refetch()}
              />
            </SettingsCard>
          </SettingsGroup>
        ) : null}

        {renderConsole()}
        {!status && !statusQuery.isError ? <Text style={{ color: c.foregroundMuted }}>Loading...</Text> : null}

        {renderSettings()}
      </View>
    </ScrollView>
  );
}
