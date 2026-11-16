import { useEffect } from "react";
import { ToastRegion } from "@ui-sdk/react/toast";
import { useShortcut } from "@ui-sdk/react/shortcuts";
import { toastError, toastSuccess } from "./lib/toast";
import { applyAppearance, watchSystemTheme } from "./lib/appearance";
import { tabDisplayNames } from "./lib/tabs";
import { useAutoSave } from "./store/persistence";
import { useAppStore } from "./store/useAppStore";
import { ConfirmDialog } from "./components/common/ConfirmDialog";
import { SaveRequestDialog } from "./components/dialogs/SaveRequestDialog";
import { TopBar } from "./components/layout/TopBar";
import { Workbench } from "./components/layout/Workbench";

function CloseTabDialog() {
  const tabs = useAppStore((state) => state.tabs);
  const pendingCloseTabId = useAppStore((state) => state.pendingCloseTabId);
  const confirmCloseTab = useAppStore((state) => state.confirmCloseTab);
  const cancelCloseTab = useAppStore((state) => state.cancelCloseTab);
  const pending = tabs.find((tab) => tab.id === pendingCloseTabId) ?? null;
  const name = pending
    ? (tabDisplayNames(tabs).get(pending.id) ?? pending.name)
    : "";

  return (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) cancelCloseTab();
      }}
      title="Discard unsaved changes?"
      description={`“${name}” has unsaved changes. Closing it will discard them.`}
      confirmLabel="Discard"
      agentConfirm="Discards unsaved changes and closes the tab"
      onConfirm={confirmCloseTab}
    />
  );
}

export default function App() {
  const hydrate = useAppStore((state) => state.hydrate);
  const hydrated = useAppStore((state) => state.hydrated);
  const loadWarning = useAppStore((state) => state.loadWarning);
  const dismissLoadWarning = useAppStore((state) => state.dismissLoadWarning);
  const sidebarVisible = useAppStore((state) => state.data.layout.sidebarVisible);
  const setSidebarVisible = useAppStore((state) => state.setSidebarVisible);
  const theme = useAppStore((state) => state.data.settings.theme);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (theme !== "system") return;
    return watchSystemTheme(() => {
      const state = useAppStore.getState();
      if (state.data.settings.theme !== "system") return;
      applyAppearance("system", state.data.settings.accent);
    });
  }, [theme]);

  useEffect(() => {
    if (!loadWarning) return;
    toastError("Stored workspace could not be loaded", loadWarning);
    dismissLoadWarning();
  }, [loadWarning, dismissLoadWarning]);

  useAutoSave();

  useShortcut(
    "mod+enter",
    () => {
      void useAppStore.getState().sendActive();
    },
    { description: "Send request" },
  );

  useShortcut(
    "mod+s",
    () => {
      const state = useAppStore.getState();
      const tab = state.tabs.find((item) => item.id === state.activeTabId);
      if (!tab) return;
      if (tab.savedRequestId) {
        toastSuccess("All changes saved", "This request persists automatically.");
      } else {
        state.openSaveDialog();
      }
    },
    { description: "Save request" },
  );

  useShortcut(
    "mod+w",
    () => {
      const state = useAppStore.getState();
      state.requestCloseTab(state.activeTabId);
    },
    { description: "Close tab" },
  );

  useShortcut(
    "mod+k",
    () => {
      document
        .querySelector<HTMLInputElement>("[data-request-url]")
        ?.focus();
    },
    { description: "Focus request URL" },
  );

  return (
    <div className="app-root">
      <TopBar
        sidebarVisible={sidebarVisible}
        onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
      />
      {hydrated ? (
        <Workbench sidebarVisible={sidebarVisible} />
      ) : (
        <div className="app-body">
          <div className="empty-state" style={{ height: "100%" }}>
            <span className="spinner" />
            Loading workspace…
          </div>
        </div>
      )}
      <SaveRequestDialog />
      <CloseTabDialog />
      <ToastRegion className="toast-region" data-agent-hidden />
    </div>
  );
}
