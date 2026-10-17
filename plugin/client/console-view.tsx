import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { usePaseo, type PluginScreenProps } from "@getpaseo/plugin/client";
import { copyText, useToast } from "@getpaseo/plugin/client/react-native";
import { ExternalLink } from "@getpaseo/plugin/client/ui";
import { useQuery } from "@tanstack/react-query";
import { formatUptime, type ConsoleStatus, type UrlCandidate } from "../shared/console";
import { useConsoleActions, useConsoleLogs, useConsoleStatus } from "./hooks";
import { Button, Card, Dot, type ThemeProps } from "./parts";
import { SettingsBlock } from "./settings-block";
import { STATE_LABEL, stateColor, useStyles } from "./theme";

type Navigation = PluginScreenProps["navigation"];

export interface ConsoleViewProps extends ThemeProps {
  navigation: Navigation;
  /** Workspace to open the Paseo browser tab in. Without one, a picker is shown. */
  workspaceId: string | null;
  /** Open the Paseo browser tab as soon as the console answers (set by the Command Center item). */
  autoOpen?: boolean;
}

function WorkspacePicker({
  theme,
  layout,
  value,
  onChange,
}: ThemeProps & { value: string | null; onChange: (id: string) => void }) {
  const styles = useStyles(theme, layout);
  const paseo = usePaseo();
  const workspaces = useQuery({
    queryKey: ["bmad-console", "workspaces"],
    queryFn: async () => (await paseo.workspaces.list()).entries,
  });
  const entries = useMemo(() => workspaces.data ?? [], [workspaces.data]);
  useEffect(() => {
    if (value === null && entries.length > 0) onChange(entries[0].id);
  }, [entries, value, onChange]);
  if (entries.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.muted}>Paseo browser workspace</Text>
      <View style={styles.wrapRow}>
        {entries.slice(0, 8).map((workspace) => (
          <Button
            key={workspace.id}
            theme={theme}
            layout={layout}
            label={workspace.name}
            primary={workspace.id === value}
            onPress={() => onChange(workspace.id)}
          />
        ))}
      </View>
    </View>
  );
}

function StatusCard({ theme, layout, status }: ThemeProps & { status: ConsoleStatus }) {
  const styles = useStyles(theme, layout);
  return (
    <Card theme={theme} layout={layout}>
      <View style={styles.row}>
        <Dot color={stateColor(theme, status.state)} />
        <Text style={styles.title}>{STATE_LABEL[status.state]}</Text>
      </View>
      <Text style={styles.muted}>
        Port {status.port} | Mode {status.mode}
        {status.uptimeSeconds !== null ? ` | Up ${formatUptime(status.uptimeSeconds)}` : ""}
        {status.pid !== null ? ` | PID ${status.pid}` : ""}
      </Text>
      {status.noLoginActive ? (
        <Text style={styles.warning}>Login is disabled for this run (no-login mode).</Text>
      ) : null}
      {status.state === "starting" ? (
        <Text style={styles.muted}>Waiting for the console to answer. The first start can take a while.</Text>
      ) : null}
      {status.state === "external" ? (
        <Text style={styles.muted}>
          This console was not started by the plugin, so the plugin will not stop it.
        </Text>
      ) : null}
      {status.state === "not_configured" ? (
        <Text style={styles.muted}>Set the console directory under Settings below to get started.</Text>
      ) : null}
      {status.configError && status.state !== "running" && status.state !== "external" ? (
        <Text style={styles.danger}>{status.configError}</Text>
      ) : null}
      {status.settingsError ? <Text style={styles.danger}>{status.settingsError}</Text> : null}
      {status.state === "crashed" ? (
        <View style={{ gap: 4 }}>
          <Text style={styles.danger}>
            The console exited (code {status.lastExit?.code ?? "none"}, signal{" "}
            {status.lastExit?.signal ?? "none"}). It is not restarted automatically.
          </Text>
          {status.crashLines.map((line, index) => (
            <Text key={`${index}-${line}`} style={styles.mono} selectable>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function UrlList({
  theme,
  layout,
  status,
  canOpenBrowser,
}: ThemeProps & { status: ConsoleStatus; canOpenBrowser: boolean }) {
  const styles = useStyles(theme, layout);
  const toast = useToast();
  async function copy(url: string) {
    try {
      await copyText(url);
      toast.show("Copied", { variant: "success" });
    } catch {
      toast.error("Could not copy. Select the URL and use Copy.");
    }
  }
  const ordered: UrlCandidate[] = canOpenBrowser
    ? status.urls.all
    : [...status.urls.all].sort((a, b) => Number(b.kind === "public") - Number(a.kind === "public"));
  const needsHint = !status.urls.public && !canOpenBrowser;
  return (
    <Card theme={theme} layout={layout}>
      <Text style={styles.sectionTitle}>Addresses</Text>
      {ordered.map((candidate) => (
        <View key={candidate.kind} style={styles.urlRow}>
          <Text style={styles.muted}>{candidate.label}</Text>
          <View style={styles.wrapRow}>
            <ExternalLink href={candidate.url}>
              <Text style={styles.link}>{candidate.url}</Text>
            </ExternalLink>
            <Button
              theme={theme}
              layout={layout}
              label="Copy"
              onPress={() => void copy(candidate.url)}
            />
          </View>
        </View>
      ))}
      {needsHint ? (
        <Text style={styles.muted}>
          A phone or another computer needs the Tailscale or LAN address of this machine. Set it as
          the public URL in Settings, and set the bind host to an address that device can reach.
          {status.bindHost === "127.0.0.1" || status.bindHost === "localhost"
            ? " The bind host is currently 127.0.0.1, which is not reachable from a phone."
            : ""}
        </Text>
      ) : null}
    </Card>
  );
}

function LogsSection({ theme, layout }: ThemeProps) {
  const styles = useStyles(theme, layout);
  const [open, setOpen] = useState(false);
  const logs = useConsoleLogs(open);
  return (
    <Card theme={theme} layout={layout}>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Text style={styles.sectionTitle}>Logs</Text>
        <View style={styles.row}>
          {open ? (
            <Button
              theme={theme}
              layout={layout}
              label="Refresh"
              pending={logs.isFetching}
              onPress={() => void logs.refetch()}
            />
          ) : null}
          <Button
            theme={theme}
            layout={layout}
            label={open ? "Hide" : "Show"}
            onPress={() => setOpen((value) => !value)}
          />
        </View>
      </View>
      {open ? (
        <ScrollView style={styles.logBox} nestedScrollEnabled>
          {logs.isError ? (
            <Text style={styles.danger}>Could not load logs.</Text>
          ) : (logs.data?.lines.length ?? 0) === 0 ? (
            <Text style={styles.muted}>No output yet.</Text>
          ) : (
            logs.data?.lines.map((line, index) => (
              <Text key={`${index}-${line.slice(0, 24)}`} style={styles.mono} selectable>
                {line}
              </Text>
            ))
          )}
        </ScrollView>
      ) : null}
    </Card>
  );
}

export function ConsoleView({ theme, layout, navigation, workspaceId, autoOpen }: ConsoleViewProps) {
  const styles = useStyles(theme, layout);
  const toast = useToast();
  const statusQuery = useConsoleStatus();
  const actions = useConsoleActions();
  const [picked, setPicked] = useState<string | null>(workspaceId);
  const targetWorkspace = workspaceId ?? picked;
  const openBrowser = navigation?.openBrowser;
  const canOpenBrowser = openBrowser !== undefined;
  const status = statusQuery.data;

  // Electron: the Paseo browser runs on the desktop, so its address is the local one.
  const browserUrl = status ? status.urls.local : null;
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

  async function copyPrimary() {
    if (!status) return;
    const url = canOpenBrowser ? status.urls.local : status.urls.preferred;
    try {
      await copyText(url);
      toast.show("Copied", { variant: "success" });
    } catch {
      toast.error("Could not copy. Select the URL and use Copy.");
    }
  }

  const busy = actions.start.isPending || actions.stop.isPending || actions.restart.isPending;
  const owned = status?.pid !== null && status?.pid !== undefined;
  const ready = Boolean(status?.configured) && !status?.configError;
  const transitional = status?.state === "starting" || status?.state === "stopping";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>BMAD Console</Text>
      {statusQuery.isError ? (
        <Card theme={theme} layout={layout}>
          <Text style={styles.danger}>
            Could not reach the plugin on the daemon. Check that the plugin is running.
          </Text>
          <Button theme={theme} layout={layout} label="Retry" onPress={() => void statusQuery.refetch()} />
        </Card>
      ) : null}
      {status ? <StatusCard theme={theme} layout={layout} status={status} /> : null}
      {!status && !statusQuery.isError ? <Text style={styles.muted}>Loading...</Text> : null}

      {status ? (
        <Card theme={theme} layout={layout}>
          <View style={styles.wrapRow}>
            <Button
              theme={theme}
              layout={layout}
              primary
              label="Start"
              pending={actions.start.isPending}
              disabled={busy || !ready || owned || status.state === "external"}
              onPress={() => actions.start.mutate()}
            />
            <Button
              theme={theme}
              layout={layout}
              label="Stop"
              pending={actions.stop.isPending}
              disabled={busy || !owned}
              onPress={() => actions.stop.mutate()}
            />
            <Button
              theme={theme}
              layout={layout}
              label="Restart"
              pending={actions.restart.isPending}
              disabled={busy || !ready || !owned || transitional}
              onPress={() => actions.restart.mutate()}
            />
          </View>
          <View style={styles.wrapRow}>
            {canOpenBrowser && targetWorkspace ? (
              <Button
                theme={theme}
                layout={layout}
                label="Open in Paseo browser"
                disabled={!reachable}
                onPress={openInPaseo}
              />
            ) : null}
            {reachable ? (
              <ExternalLink href={canOpenBrowser ? status.urls.local : status.urls.preferred}>
                <Text style={styles.link}>Open in browser</Text>
              </ExternalLink>
            ) : (
              <Text style={styles.muted}>Open in browser (available once running)</Text>
            )}
            <Button theme={theme} layout={layout} label="Copy URL" onPress={() => void copyPrimary()} />
          </View>
          {canOpenBrowser && workspaceId === null ? (
            <WorkspacePicker theme={theme} layout={layout} value={picked} onChange={setPicked} />
          ) : null}
        </Card>
      ) : null}

      {status ? <UrlList theme={theme} layout={layout} status={status} canOpenBrowser={canOpenBrowser} /> : null}
      <LogsSection theme={theme} layout={layout} />
      <SettingsBlock theme={theme} layout={layout} />
    </ScrollView>
  );
}
