import { useEffect } from "react";
import type { AppData, PersistedTab, TabState } from "../types";
import { saveAppData } from "../lib/api";
import { toastError } from "../lib/toast";
import { useAppStore } from "./useAppStore";

interface PersistSource {
  data: AppData;
  tabs: TabState[];
  activeTabId: string;
}

function persistTab(tab: TabState): PersistedTab {
  return {
    id: tab.id,
    name: tab.name,
    request: tab.request,
    savedRequestId: tab.savedRequestId,
    dirty: tab.dirty,
  };
}

export function snapshotData(state: PersistSource): AppData {
  return {
    ...state.data,
    tabs: state.tabs.map(persistTab),
    activeTabId: state.activeTabId,
  };
}

export function currentSnapshot(): AppData {
  return snapshotData(useAppStore.getState());
}

export function useAutoSave(): void {
  const hydrated = useAppStore((state) => state.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: AppData | null = null;
    let last = "";
    let lastError = "";

    const flush = () => {
      if (!pending) return;
      const payload = pending;
      pending = null;
      void saveAppData(payload)
        .then(() => {
          lastError = "";
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          if (message !== lastError) {
            lastError = message;
            toastError("Workspace could not be saved", error);
          }
        });
    };

    const schedule = (state: PersistSource) => {
      const payload = snapshotData(state);
      const serialized = JSON.stringify(payload);
      if (serialized === last) return;
      last = serialized;
      pending = payload;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 400);
    };

    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (!state.hydrated) return;
      if (
        state.data === previous.data &&
        state.tabs === previous.tabs &&
        state.activeTabId === previous.activeTabId
      ) {
        return;
      }
      schedule(state);
    });

    const onBlur = () => flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    schedule(useAppStore.getState());

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
      flush();
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hydrated]);
}
