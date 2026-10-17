import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { usePaseo, useSettings, type PluginScreenProps } from "@getpaseo/plugin/client";
import { Modal, ScrollView, copyText, useToast } from "@getpaseo/plugin/client/react-native";
import {
  ExternalLink,
  SettingsAction,
  SettingsCard,
  SettingsGroup,
  SettingsInput,
  SettingsRow,
  SettingsSelect,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import { useQuery } from "@tanstack/react-query";
import { consoleSettings, validateSettings } from "../shared/console";
import { useConsoleActions, useConsoleLogs, useConsoleStatus } from "./hooks";
import { actionsFor, hasChanges, normalizeValues, pickWorkspace, statusChip, statusRow, type ChipTone } from "./logic";

type Theme = PluginScreenProps["theme"];

const MODES = [
  { label: "Development (next dev)", value: "dev" },
  { label: "Production (next start, needs a build)", value: "start" },
] as const;

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

function Chip({ theme, label, tone }: { theme: Theme; label: string; tone?: ChipTone }) {
  const c = theme.colors;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: c.surface1,
      }}
    >
      {tone ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: toneColor(theme, tone) }} /> : null}
      <Text style={{ color: tone ? toneColor(theme, tone) : c.foregroundMuted, fontSize: 12 }}>{label}</Text>
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
  const logs = useConsoleLogs();
  const settings = useSettings(consoleSettings);
  const status = statusQuery.data;

  const [logsOpen, setLogsOpen] = useState(false);
  const [draft, setDraft] = useState<ReturnType<typeof consoleSettings.schema.parse> | null>(null);
  const [portText, setPortText] = useState<string | null>(null);

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

  const autoOpened = useRef(false);
  useEffect(() => {
    if (!autoOpen || autoOpened.current || !reachable || !openBrowser || !targetWorkspace || !browserUrl) return;
    autoOpened.current = true;
    try {
      openBrowser({ url: browserUrl, workspaceId: targetWorkspace });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }, [autoOpen, reachable, openBrowser, targetWorkspace, browserUrl, toast]);

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
  const logLines = logs.data?.lines.length ? logs.data.lines : (status?.crashLines ?? []);
  const logCount = logs.data?.total ?? logLines.length;

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
      <SettingsGroup title="Settings">
        <SettingsCard>
          <SettingsInput
            key={`dir-${keyBase}`}
            label="Console directory"
            hint="Where paseo-bmad-console is checked out on this machine."
            placeholder="/path/to/paseo-bmad-console"
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
          <SettingsSelect
            label="Mode"
            hint="Production needs a build first."
            value={current.mode}
            options={MODES}
            onValueChange={(mode) => change({ mode })}
          />
          <SettingsInput
            key={`host-${keyBase}`}
            label="Bind host"
            hint="127.0.0.1 keeps it on this machine. The console has no login, so only use 0.0.0.0 or a Tailscale or LAN address on a private network."
            initialValue={current.bindHost}
            error={errors.bindHost}
            onChangeText={(bindHost) => change({ bindHost })}
          />
          <SettingsInput
            key={`public-${keyBase}`}
            label="Public URL"
            hint="Optional. The address your other devices use, for example your Tailscale URL."
            placeholder="https://my-machine.tailnet.ts.net:7002"
            initialValue={current.publicUrl}
            error={errors.publicUrl}
            onChangeText={(publicUrl) => change({ publicUrl })}
          />
          <SettingsInput
            key={`origins-${keyBase}`}
            label="Allowed dev origins"
            hint="Optional. Comma separated host names allowed to load the dev server."
            placeholder="my-machine.tailnet.ts.net"
            initialValue={current.allowedDevOrigins}
            error={errors.allowedDevOrigins}
            onChangeText={(allowedDevOrigins) => change({ allowedDevOrigins })}
          />
          <SettingsSwitch
            label="Start with Paseo"
            hint="Start the console when Paseo starts."
            value={current.autoStart}
            onValueChange={(autoStart) => change({ autoStart })}
          />
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
              <Chip theme={theme} label={`:${status.port}`} />
              <Chip theme={theme} label={status.mode} />
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

        {status && row && toShow ? (
          <SettingsGroup title="Console">
            <SettingsCard>
              <SettingsRow label="Status" hint={row.hint}>
                <Text style={{ color: c.foregroundMuted, fontSize: 14 }}>{row.value}</Text>
              </SettingsRow>
              {toShow.start ? (
                <SettingsAction
                  label="Start"
                  actionLabel="Start"
                  disabled={busy || toShow.start.disabled}
                  onPress={() => actions.start.mutate()}
                />
              ) : null}
              {toShow.restart ? (
                <SettingsAction
                  label="Restart"
                  actionLabel="Restart"
                  disabled={busy || toShow.restart.disabled}
                  onPress={() => actions.restart.mutate()}
                />
              ) : null}
              {toShow.stop ? (
                <SettingsAction label="Stop" actionLabel="Stop" disabled={busy} onPress={() => actions.stop.mutate()} />
              ) : null}
              {openBrowser ? (
                <SettingsAction
                  label="Open"
                  hint="In a Paseo browser tab"
                  actionLabel="Open"
                  disabled={!reachable || !targetWorkspace}
                  onPress={openInPaseo}
                />
              ) : (
                <SettingsRow label="Open" hint="In your browser">
                  {reachable ? (
                    <ExternalLink href={status.urls.preferred}>
                      <Text style={{ color: c.accent, fontSize: 14 }}>Open in browser</Text>
                    </ExternalLink>
                  ) : (
                    <Text style={{ color: c.foregroundMuted, fontSize: 14 }}>Open in browser</Text>
                  )}
                </SettingsRow>
              )}
              <SettingsAction
                label="Address"
                hint={status.urls.public ? status.urls.preferred : `${status.urls.preferred}\nSet a public URL to open this from your phone`}
                actionLabel="Copy"
                onPress={() => void copy(status.urls.preferred, "Address copied")}
              />
              <SettingsAction
                label="Logs"
                hint={status.state === "crashed" && logLines.length > 0 ? `${logCount} lines. Last: ${logLines[logLines.length - 1]}` : `${logCount} ${logCount === 1 ? "line" : "lines"}`}
                actionLabel="View logs"
                onPress={() => {
                  setLogsOpen(true);
                  void logs.refetch();
                }}
              />
            </SettingsCard>
          </SettingsGroup>
        ) : null}
        {!status && !statusQuery.isError ? <Text style={{ color: c.foregroundMuted }}>Loading...</Text> : null}

        {renderSettings()}
      </View>

      <Modal title="Logs" open={logsOpen} onOpenChange={setLogsOpen}>
        <Modal.Content>
          <SettingsCard>
            <SettingsAction
              label="Copy logs"
              actionLabel="Copy"
              disabled={logLines.length === 0}
              onPress={() => void copy(logLines.join("\n"), "Logs copied")}
            />
          </SettingsCard>
          <ScrollView style={{ maxHeight: 360 }} nestedScrollEnabled>
            {logLines.length === 0 ? (
              <Text style={{ color: c.foregroundMuted }}>{logs.isError ? "Could not load logs." : "No output yet."}</Text>
            ) : (
              logLines.map((line, index) => (
                <Text
                  key={`${index}-${line.slice(0, 24)}`}
                  selectable
                  style={{ color: c.foreground, fontFamily: "monospace", fontSize: 12, lineHeight: 17 }}
                >
                  {line}
                </Text>
              ))
            )}
          </ScrollView>
        </Modal.Content>
      </Modal>
    </ScrollView>
  );
}
