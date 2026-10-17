import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { usePaseo, useSettings, type PluginScreenProps } from "@getpaseo/plugin/client";
import { Icon, ScrollView, copyText, useToast } from "@getpaseo/plugin/client/react-native";
import { SettingsCard, SettingsInput, SettingsSelect } from "@getpaseo/plugin/client/ui";
import { useQuery } from "@tanstack/react-query";
import { consoleSettings, type ConsoleStatus } from "../shared/console";
import { useConsoleActions, useConsoleLogs, useConsoleStatus } from "./hooks";
import {
  ACTION_LABEL,
  isRunningState,
  pickWorkspace,
  statusNote,
  statusPill,
  statusSubtitle,
  validateFolder,
  visibleActions,
  type SettingsGroupId,
  type WorkspaceEntry,
} from "./logic";
import { SettingsView } from "./settings-view";
import { useStyles } from "./theme";
import { Banner, Button, IconButton, IconLink, LinkButton, NavRow, Section, StatusPill, type ThemeProps } from "./ui";

type Navigation = PluginScreenProps["navigation"];

export interface ConsoleViewProps extends ThemeProps {
  navigation: Navigation;
  /** Workspace to open the Paseo browser tab in; falls back to the last used one. */
  workspaceId: string | null;
  /** Open the Paseo browser tab as soon as the console answers (set by the Command Center item). */
  autoOpen?: boolean;
  /** Workspace panel: status, actions and the main address only. */
  compact?: boolean;
}

function useCopy() {
  const toast = useToast();
  return async (text: string, done = "Copied") => {
    try {
      await copyText(text);
      toast.show(done, { variant: "success" });
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  };
}

function Header({ theme, layout, status }: ThemeProps & { status: ConsoleStatus | undefined }) {
  const styles = useStyles(theme, layout);
  const pill = statusPill(status?.state ?? "not_configured");
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Icon name="ListChecks" size={20} color={theme.colors.foreground} />
        <Text accessibilityRole="header" style={styles.title}>
          BMAD Console
        </Text>
        {status ? <StatusPill theme={theme} layout={layout} label={pill.label} tone={pill.tone} /> : null}
      </View>
      {status ? <Text style={styles.subtitle}>{statusSubtitle(status)}</Text> : null}
    </View>
  );
}

function Onboarding({
  theme,
  layout,
  settings,
  onStart,
}: ThemeProps & { settings: ReturnType<typeof useSettings<typeof consoleSettings.schema>>; onStart: () => void }) {
  const styles = useStyles(theme, layout);
  const toast = useToast();
  const [folder, setFolder] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const error = validateFolder(folder, submitted);
  const ready = settings.status === "ready";
  const canSubmit = ready && validateFolder(folder, true) === null;

  async function submit() {
    setSubmitted(true);
    if (settings.status !== "ready" || validateFolder(folder, true) !== null) return;
    const saved = await settings.save({ ...settings.values, consoleDirectory: folder.trim() }, settings.revision);
    if (saved) onStart();
    else toast.error(settings.saveError ?? "Could not save the folder.");
  }

  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={styles.textStrong}>
        Set up BMAD Console
      </Text>
      <Text style={styles.muted}>
        Paseo starts the BMAD Console web app from a local checkout. Point it at that folder to begin.
      </Text>
      <Text style={styles.small}>Step 1 of 1</Text>
      <SettingsCard>
        <SettingsInput
          label="Choose the console folder"
          hint="The folder that contains paseo-bmad-console's package.json."
          placeholder="/path/to/paseo-bmad-console"
          initialValue=""
          error={error}
          disabled={!ready || settings.saving}
          onChangeText={setFolder}
        />
      </SettingsCard>
      {settings.status !== "ready" && settings.status !== "loading" ? (
        <Banner theme={theme} layout={layout} tone="danger" text={settings.error} />
      ) : null}
      {settings.status === "ready" && settings.saveError ? (
        <Banner theme={theme} layout={layout} tone="danger" text={settings.saveError} />
      ) : null}
      <View style={styles.wrapRow}>
        <Button
          theme={theme}
          layout={layout}
          variant="primary"
          label="Save and start"
          pending={settings.saving}
          disabled={!canSubmit}
          onPress={() => void submit()}
        />
      </View>
    </View>
  );
}

function AddressRows({
  theme,
  layout,
  status,
  compact,
  onAddPublic,
}: ThemeProps & { status: ConsoleStatus; compact: boolean; onAddPublic: () => void }) {
  const styles = useStyles(theme, layout);
  const copy = useCopy();
  const all = compact ? status.urls.all.filter((c) => c.url === status.urls.preferred) : status.urls.all;
  return (
    <View>
      {all.map((candidate, index) => (
        <View key={candidate.kind}>
          {index > 0 ? <View style={styles.separator} /> : null}
          <View style={styles.row}>
            <View style={styles.rowFill}>
              <Text style={styles.small}>
                {candidate.label}
                {candidate.url === status.urls.preferred ? " · Preferred" : ""}
              </Text>
              <Text style={styles.text} selectable numberOfLines={1}>
                {candidate.url}
              </Text>
            </View>
            <IconLink theme={theme} layout={layout} icon="ExternalLink" label={`Open ${candidate.label} address in browser`} href={candidate.url} />
            <IconButton
              theme={theme}
              layout={layout}
              icon="Copy"
              label={`Copy ${candidate.label} address`}
              onPress={() => void copy(candidate.url)}
            />
          </View>
        </View>
      ))}
      {!status.urls.public ? (
        <>
          <View style={styles.separator} />
          <NavRow
            theme={theme}
            layout={layout}
            icon="Smartphone"
            label="Add your Tailscale address to open this from your phone"
            onPress={onAddPublic}
          />
        </>
      ) : null}
    </View>
  );
}

function LogsSection({ theme, layout, status }: ThemeProps & { status: ConsoleStatus }) {
  const styles = useStyles(theme, layout);
  const copy = useCopy();
  const crashed = status.state === "crashed";
  const [open, setOpen] = useState(crashed);
  const logs = useConsoleLogs(open);
  const wasCrashed = useRef(crashed);
  useEffect(() => {
    if (crashed && !wasCrashed.current) setOpen(true);
    wasCrashed.current = crashed;
  }, [crashed]);

  const lines = logs.data?.lines.length ? logs.data.lines : status.crashLines;
  const total = logs.data?.total ?? lines.length;
  const countLabel = `${total} ${total === 1 ? "line" : "lines"}`;
  return (
    <Section theme={theme} layout={layout} title="Logs">
      <NavRow
        theme={theme}
        layout={layout}
        icon="Terminal"
        label={open ? "Hide logs" : "Show logs"}
        value={countLabel}
        chevron={open ? "ChevronDown" : "ChevronRight"}
        onPress={() => setOpen((value) => !value)}
      />
      {open ? (
        <View style={{ gap: 8, paddingTop: 4 }}>
          <View style={styles.wrapRow}>
            <Button
              theme={theme}
              layout={layout}
              icon="RefreshCw"
              label="Refresh"
              pending={logs.isFetching}
              onPress={() => void logs.refetch()}
            />
            <Button
              theme={theme}
              layout={layout}
              icon="Copy"
              label="Copy"
              disabled={lines.length === 0}
              onPress={() => void copy(lines.join("\n"), "Logs copied")}
            />
          </View>
          <ScrollView style={styles.logBox} nestedScrollEnabled>
            {logs.isError ? (
              <Text style={styles.danger}>Could not load logs.</Text>
            ) : lines.length === 0 ? (
              <Text style={styles.muted}>No output yet.</Text>
            ) : (
              lines.map((line, index) => (
                <Text key={`${index}-${line.slice(0, 24)}`} style={styles.mono} selectable>
                  {line}
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      ) : null}
    </Section>
  );
}

export function ConsoleView({ theme, layout, navigation, workspaceId, autoOpen, compact = false }: ConsoleViewProps) {
  const styles = useStyles(theme, layout);
  const toast = useToast();
  const paseo = usePaseo();
  const statusQuery = useConsoleStatus();
  const actions = useConsoleActions();
  const settings = useSettings(consoleSettings);
  const [view, setView] = useState<"main" | "settings">("main");
  const [focus, setFocus] = useState<SettingsGroupId | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const openBrowser = navigation?.openBrowser;
  const canOpenBrowser = openBrowser !== undefined;
  const status = statusQuery.data;

  const workspaces = useQuery({
    queryKey: ["bmad-console", "workspaces"],
    queryFn: async () => (await paseo.workspaces.list()).entries,
    enabled: canOpenBrowser,
  });
  const entries: WorkspaceEntry[] = useMemo(
    () => (workspaces.data ?? []).map((w) => ({ id: w.id, name: w.name })),
    [workspaces.data],
  );
  const remembered = settings.status === "ready" ? (settings.values.lastWorkspaceId ?? "") : "";
  const targetWorkspace = pickWorkspace({
    requestedId: picked ?? workspaceId,
    rememberedId: remembered,
    entries,
  });

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

  function chooseWorkspace(id: string) {
    setPicked(id);
    if (settings.status === "ready" && settings.values.lastWorkspaceId !== id) {
      void settings.save({ ...settings.values, lastWorkspaceId: id }, settings.revision);
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

  function showSettings(group: SettingsGroupId | null) {
    setFocus(group);
    setView("settings");
  }

  if (view === "settings") {
    return (
      <SettingsView
        theme={theme}
        layout={layout}
        settings={settings}
        focus={focus}
        onBack={() => setView("main")}
      />
    );
  }

  const busy = actions.start.isPending || actions.stop.isPending || actions.restart.isPending;
  const note = status ? statusNote(status) : null;
  const running = status ? isRunningState(status.state) : false;
  const preferredUrl = status ? (canOpenBrowser ? status.urls.local : status.urls.preferred) : "";

  function renderAction(id: ReturnType<typeof visibleActions>[number]) {
    if (!status) return null;
    const label = ACTION_LABEL[id.id];
    const variant = id.primary ? "primary" : "secondary";
    switch (id.id) {
      case "open":
        if (openBrowser && targetWorkspace) {
          return (
            <Button key="open" theme={theme} layout={layout} variant={variant} icon="ExternalLink" label={label} disabled={!reachable} onPress={openInPaseo} />
          );
        }
        return <LinkButton key="open" theme={theme} layout={layout} variant={variant} icon="ExternalLink" label={canOpenBrowser ? label : "Open in browser"} href={preferredUrl} />;
      case "start":
        return (
          <Button key="start" theme={theme} layout={layout} variant={variant} icon="Play" label={label} pending={actions.start.isPending} disabled={busy || id.disabled} onPress={() => actions.start.mutate()} />
        );
      case "restart":
        return (
          <Button key="restart" theme={theme} layout={layout} variant={variant} icon="RotateCw" label={label} pending={actions.restart.isPending} disabled={busy || id.disabled} onPress={() => actions.restart.mutate()} />
        );
      case "stop":
        return (
          <Button key="stop" theme={theme} layout={layout} variant={variant} icon="Square" label={label} pending={actions.stop.isPending} disabled={busy} onPress={() => actions.stop.mutate()} />
        );
      default:
        return (
          <Button key={id.id} theme={theme} layout={layout} variant={variant} label={`${label}...`} pending disabled onPress={() => {}} />
        );
    }
  }

  const showOnboarding = status?.state === "not_configured" && !status.settingsError;
  const showWorkspacePicker = canOpenBrowser && running && entries.length > 1 && targetWorkspace !== null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.column}>
        <Header theme={theme} layout={layout} status={status} />

        {statusQuery.isError ? (
          <View style={{ gap: 8 }}>
            <Banner theme={theme} layout={layout} tone="danger" text="Could not reach the plugin on the Paseo daemon. Check that the plugin is running." />
            <View style={styles.wrapRow}>
              <Button theme={theme} layout={layout} label="Retry" icon="RefreshCw" onPress={() => void statusQuery.refetch()} />
            </View>
          </View>
        ) : null}
        {!status && !statusQuery.isError ? <Text style={styles.muted}>Loading...</Text> : null}

        {status && showOnboarding ? (
          <Onboarding theme={theme} layout={layout} settings={settings} onStart={() => actions.start.mutate()} />
        ) : null}

        {status && !showOnboarding ? (
          <>
            {note ? (
              note.tone === "muted" ? (
                <Text style={[styles.muted, { paddingBottom: 12 }]}>{note.text}</Text>
              ) : (
                <View style={{ paddingBottom: 12 }}>
                  <Banner theme={theme} layout={layout} tone={note.tone} text={note.text} />
                </View>
              )
            ) : null}
            <View style={styles.wrapRow}>
              {visibleActions(status).map(renderAction)}
              {status.state === "crashed" ? (
                <Text style={styles.small}>Logs are below.</Text>
              ) : null}
            </View>
            {showWorkspacePicker ? (
              <View style={{ paddingTop: 12 }}>
                <SettingsCard>
                  <SettingsSelect
                    label="Open in workspace"
                    value={targetWorkspace}
                    options={entries.map((e) => ({ label: e.name, value: e.id }))}
                    onValueChange={chooseWorkspace}
                  />
                </SettingsCard>
              </View>
            ) : null}

            <Section theme={theme} layout={layout} title="Addresses">
              <AddressRows
                theme={theme}
                layout={layout}
                status={status}
                compact={compact}
                onAddPublic={() => showSettings("network")}
              />
            </Section>

            {compact ? null : <LogsSection theme={theme} layout={layout} status={status} />}
          </>
        ) : null}

        {status ? (
          <Section theme={theme} layout={layout}>
            <NavRow theme={theme} layout={layout} icon="Settings" label="Settings" onPress={() => showSettings(null)} />
          </Section>
        ) : null}
      </View>
    </ScrollView>
  );
}
