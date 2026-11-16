import { useEffect, useState, type CSSProperties } from "react";
import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ui-sdk/react/dialog";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@ui-sdk/react/tabs";
import { ACCENT_OPTIONS, useResolvedTheme } from "../../lib/appearance";
import {
  appDataPath,
  clearCookies,
  pickOpenPath,
  readTextFile,
  saveTextAs,
} from "../../lib/api";
import { toastError, toastSuccess } from "../../lib/toast";
import { currentSnapshot } from "../../store/persistence";
import { useAppStore } from "../../store/useAppStore";
import { ConfirmDialog } from "../common/ConfirmDialog";
import type { ThemePreference } from "../../types";

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const settings = useAppStore((state) => state.data.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setTheme = useAppStore((state) => state.setTheme);
  const setAccent = useAppStore((state) => state.setAccent);
  const replaceData = useAppStore((state) => state.replaceData);
  const [dataPath, setDataPath] = useState("");
  const [cookiesConfirmOpen, setCookiesConfirmOpen] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<unknown | null>(null);
  const resolvedTheme = useResolvedTheme(settings.theme);
  const activeAccent =
    ACCENT_OPTIONS.find((option) => option.id === settings.accent) ??
    ACCENT_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void appDataPath()
      .then((path) => {
        if (!cancelled) setDataPath(path);
      })
      .catch(() => {
        if (!cancelled) setDataPath("Unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const exportBackup = async () => {
    try {
      const json = JSON.stringify(currentSnapshot(), null, 2);
      await saveTextAs("payload-backup.json", json);
      toastSuccess("Backup exported");
    } catch (error) {
      toastError("Could not export the workspace", error);
    }
  };

  const importBackup = async () => {
    try {
      const path = await pickOpenPath();
      if (!path) return;
      const raw = await readTextFile(path);
      const parsed: unknown = JSON.parse(raw);
      setPendingBackup(parsed);
    } catch (error) {
      toastError("Could not read that backup", error);
    }
  };

  const clearSessionCookies = async () => {
    try {
      await clearCookies();
      toastSuccess("Cookies cleared");
    } catch (error) {
      toastError("Could not clear cookies", error);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
        <DialogContent className="panel-dialog settings-dialog">
          <DialogClose
            className="settings-close"
            aria-label="Close settings"
          >
            <X size={14} aria-hidden="true" />
          </DialogClose>
          <DialogTitle className="dialog-heading">Settings</DialogTitle>
          <DialogDescription className="dialog-copy">
            Preferences and defaults stored on this machine.
          </DialogDescription>
          <Tabs defaultValue="general" className="settings-tabs">
            <TabsList aria-label="Settings sections">
              <TabsTab value="general">General</TabsTab>
              <TabsTab value="network">Network</TabsTab>
              <TabsTab value="data">Data</TabsTab>
            </TabsList>

            <TabsPanel value="general" className="settings-panel">
              <section
                className="settings-section"
                aria-labelledby="settings-appearance-heading"
              >
                <h3
                  id="settings-appearance-heading"
                  className="settings-heading"
                >
                  Appearance
                </h3>
                <div className="settings-row">
                  <div>
                    <div>Theme</div>
                    <div className="settings-copy">
                      Follow the system or use light or dark for this workspace.
                    </div>
                  </div>
                  <SegmentedControl
                    className="theme-options"
                    aria-label="Theme"
                    value={settings.theme}
                    onValueChange={(value) => {
                      if (
                        value === "system" ||
                        value === "light" ||
                        value === "dark"
                      ) {
                        setTheme(value as ThemePreference);
                      }
                    }}
                  >
                    <SegmentedControlIndicator />
                    <SegmentedControlItem value="system">
                      System
                    </SegmentedControlItem>
                    <SegmentedControlItem value="light">
                      Light
                    </SegmentedControlItem>
                    <SegmentedControlItem value="dark">Dark</SegmentedControlItem>
                  </SegmentedControl>
                </div>
                <div className="settings-row">
                  <div>
                    <div>
                      Accent color —{" "}
                      <span className="accent-active">{activeAccent.label}</span>
                    </div>
                    <div className="settings-copy">
                      Highlights, focus rings and primary actions.
                    </div>
                  </div>
                  <div
                    className="accent-swatches"
                    role="group"
                    aria-label="Accent color"
                  >
                    {ACCENT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className="accent-swatch"
                        style={
                          {
                            "--swatch": option.color[resolvedTheme],
                          } as CSSProperties
                        }
                        data-selected={
                          settings.accent === option.id ? "" : undefined
                        }
                        aria-label={option.label}
                        aria-pressed={settings.accent === option.id}
                        onClick={() => setAccent(option.id)}
                      >
                        {settings.accent === option.id ? (
                          <Check size={13} strokeWidth={3} aria-hidden="true" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </TabsPanel>

            <TabsPanel value="network" className="settings-panel">
              <section
                className="settings-section"
                aria-labelledby="settings-defaults-heading"
              >
                <h3
                  id="settings-defaults-heading"
                  className="settings-heading"
                >
                  Request defaults
                </h3>
                <Field>
                  <FieldLabel>Default timeout (ms)</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={String(settings.timeoutMs)}
                    onValueChange={(value) =>
                      updateSettings({
                        timeoutMs: Math.max(0, Number(value) || 0),
                      })
                    }
                  />
                </Field>
                <div className="settings-row">
                  <div>
                    <div>Follow redirects</div>
                    <div className="settings-copy">
                      Default for new requests; each request can override it.
                    </div>
                  </div>
                  <Switch
                    checked={settings.followRedirects}
                    onCheckedChange={(checked) =>
                      updateSettings({ followRedirects: checked === true })
                    }
                    aria-label="Follow redirects by default"
                  >
                    <SwitchThumb />
                  </Switch>
                </div>
                <div className="settings-row">
                  <div>
                    <div>Verify TLS certificates</div>
                    <div className="settings-copy">
                      Turn off only for trusted self-signed local servers.
                    </div>
                  </div>
                  <Switch
                    checked={settings.verifyTls}
                    onCheckedChange={(checked) =>
                      updateSettings({ verifyTls: checked === true })
                    }
                    aria-label="Verify TLS certificates by default"
                  >
                    <SwitchThumb />
                  </Switch>
                </div>
              </section>

              <section
                className="settings-section"
                aria-labelledby="settings-proxy-heading"
              >
                <h3 id="settings-proxy-heading" className="settings-heading">
                  Proxy
                </h3>
                <Field>
                  <FieldLabel>Proxy URL</FieldLabel>
                  <Input
                    value={settings.proxy}
                    onValueChange={(proxy) => updateSettings({ proxy })}
                    placeholder="http://127.0.0.1:8080"
                    spellCheck={false}
                  />
                </Field>
                <p className="settings-copy">
                  Leave empty to use the system proxy. Applies to every request.
                </p>
              </section>

              <section
                className="settings-section"
                aria-labelledby="settings-session-heading"
              >
                <h3 id="settings-session-heading" className="settings-heading">
                  Session
                </h3>
                <div className="settings-row">
                  <div>
                    <div>Session cookies</div>
                    <div className="settings-copy">
                      Cookies collected since launch are kept in memory only.
                    </div>
                  </div>
                  <Button
                    className="small-button ghost-button"
                    onClick={() => setCookiesConfirmOpen(true)}
                  >
                    Clear cookies
                  </Button>
                </div>
              </section>
            </TabsPanel>

            <TabsPanel value="data" className="settings-panel">
              <section
                className="settings-section"
                aria-labelledby="settings-backup-heading"
              >
                <h3 id="settings-backup-heading" className="settings-heading">
                  Backup
                </h3>
                <div className="settings-row">
                  <div>
                    <div>Workspace backup</div>
                    <div className="settings-copy">
                      Collections, environments, history and open tabs.
                    </div>
                  </div>
                  <div className="settings-actions">
                    <Button
                      className="small-button ghost-button"
                      onClick={() => void exportBackup()}
                    >
                      Export
                    </Button>
                    <Button
                      className="small-button ghost-button"
                      onClick={() => void importBackup()}
                    >
                      Import
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="dialog-section-title">Data file</div>
                  <p className="data-path" title={dataPath}>
                    {dataPath || "Loading…"}
                  </p>
                </div>
              </section>
            </TabsPanel>
          </Tabs>
          <div className="dialog-actions">
            <DialogClose className="small-button ghost-button">Done</DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={cookiesConfirmOpen}
        onOpenChange={setCookiesConfirmOpen}
        title="Clear session cookies?"
        description="Servers will treat the next requests as a new session."
        confirmLabel="Clear cookies"
        agentConfirm="Clears all session cookies"
        onConfirm={() => void clearSessionCookies()}
      />
      <ConfirmDialog
        open={pendingBackup !== null}
        onOpenChange={(next) => {
          if (!next) setPendingBackup(null);
        }}
        title="Replace this workspace from the backup?"
        description="The current collections, environments, history and tabs are replaced by the backup contents."
        confirmLabel="Replace workspace"
        agentConfirm="Replaces the whole workspace from a backup file"
        onConfirm={() => {
          if (pendingBackup === null) return;
          try {
            replaceData(pendingBackup);
          } catch (error) {
            toastError("That backup is not compatible", error);
          } finally {
            setPendingBackup(null);
          }
        }}
      />
    </>
  );
}
