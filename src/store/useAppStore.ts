import { create } from "zustand";
import type {
  AppData,
  Collection,
  Environment,
  FolderNode,
  HistoryEntry,
  PersistedTab,
  RequestDef,
  Settings,
  TabState,
  TreeNode,
} from "../types";
import { applyAppearance } from "../lib/appearance";
import {
  cancelRequest,
  loadAppData,
  normalizeRequestError,
  sendRequest,
} from "../lib/api";
import { buildRequestSpec } from "../lib/build-spec";
import { uid } from "../lib/format";
import { toastError, toastSuccess } from "../lib/toast";
import { isRequestUrlReady } from "../lib/validation";
import { findRequestNode, findTarget, removeNode, renameNode } from "../lib/tree";
import { migrate } from "./migrate";
import { blankRequest, autoTabName, defaultLayout, seedData, tabFromRequest } from "./seed";

const cloneRequest = (request: RequestDef): RequestDef =>
  JSON.parse(JSON.stringify(request)) as RequestDef;

const toTabState = (tab: PersistedTab): TabState => ({
  ...tab,
  response: null,
  error: null,
  sending: false,
});

function activeTabOf(state: { tabs: TabState[]; activeTabId: string }): TabState | undefined {
  return state.tabs.find((tab) => tab.id === state.activeTabId);
}

function appendChild(
  collections: Collection[],
  parentId: string,
  node: TreeNode,
): Collection[] {
  const walk = (nodes: TreeNode[]): TreeNode[] =>
    nodes.map((child) =>
      child.type === "folder"
        ? {
            ...child,
            children:
              child.id === parentId ? [...child.children, node] : walk(child.children),
          }
        : child,
    );
  return collections.map((collection) =>
    collection.id === parentId
      ? { ...collection, children: [...collection.children, node] }
      : { ...collection, children: walk(collection.children) },
  );
}

function newScratch(
  settings: Settings,
  request?: Partial<RequestDef>,
): TabState {
  const autoNamed = !request?.name;
  const built = blankRequest({
    options: {
      timeoutMs: settings.timeoutMs,
      followRedirects: settings.followRedirects,
      verifyTls: settings.verifyTls,
    },
    ...request,
    id: uid(),
  });
  if (autoNamed) built.name = autoTabName(built.url);
  return {
    ...tabFromRequest(built, null),
    dirty: request === undefined ? false : true,
    autoNamed,
    response: null,
    error: null,
    sending: false,
  };
}

let hydrateStarted = false;

export interface AppStore {
  data: AppData;
  tabs: TabState[];
  activeTabId: string;
  hydrated: boolean;
  loadWarning: string | null;
  selectedNode: string | null;
  search: string;
  saveDialogOpen: boolean;
  pendingCloseTabId: string | null;
  focusTabToken: number;
  hydrate: () => Promise<void>;
  dismissLoadWarning: () => void;
  setTheme: (theme: Settings["theme"]) => void;
  setAccent: (accent: Settings["accent"]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setLayout: (key: "sidebar" | "split", sizes: number[]) => void;
  setSidebarVisible: (visible: boolean) => void;
  setSelectedNode: (id: string | null) => void;
  setSearch: (search: string) => void;
  createScratchTab: (partial?: Partial<RequestDef>) => string;
  openRequest: (requestId: string) => void;
  openFromHistory: (historyId: string) => void;
  closeTab: (tabId: string) => void;
  requestCloseTab: (tabId: string) => void;
  confirmCloseTab: () => void;
  cancelCloseTab: () => void;
  setActiveTab: (tabId: string) => void;
  updateActiveRequest: (patch: Partial<RequestDef>) => void;
  sendActive: () => Promise<void>;
  cancelActive: () => Promise<void>;
  dismissActiveError: () => void;
  openSaveDialog: () => void;
  closeSaveDialog: () => void;
  saveActiveTab: (name: string, targetId: string | null) => boolean;
  renameTab: (tabId: string, name: string) => void;
  duplicateActive: () => void;
  deleteActiveSaved: () => void;
  duplicateRequest: (requestId: string) => void;
  createCollection: (name: string) => string;
  createFolder: (parentId: string, name: string) => string | null;
  renameNode: (nodeId: string, name: string) => void;
  deleteNode: (nodeId: string) => void;
  setActiveEnvironment: (id: string | null) => void;
  addEnvironment: () => string;
  updateEnvironment: (id: string, patch: Partial<Environment>) => void;
  deleteEnvironment: (id: string) => void;
  clearHistory: () => void;
  replaceData: (raw: unknown) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  data: {
    version: 1,
    collections: [],
    requests: {},
    environments: [],
    activeEnvId: null,
    history: [],
    settings: {
      theme: "dark",
      accent: "teal",
      timeoutMs: 30_000,
      followRedirects: true,
      verifyTls: true,
      proxy: "",
    },
    tabs: [],
    activeTabId: "",
    layout: defaultLayout(),
  },
  tabs: [],
  activeTabId: "",
  hydrated: false,
  loadWarning: null,
  selectedNode: null,
  search: "",
  saveDialogOpen: false,
  pendingCloseTabId: null,
  focusTabToken: 0,

  hydrate: async () => {
    if (get().hydrated || hydrateStarted) return;
    hydrateStarted = true;
    let data: AppData;
    let warning: string | null = null;
    try {
      const raw = await loadAppData();
      data = raw == null ? seedData() : migrate(raw);
    } catch (error) {
      data = seedData();
      warning =
        error instanceof Error
          ? `${error.message} A fresh workspace was started.`
          : "Stored data could not be read. A fresh workspace was started.";
    }
    let tabs = data.tabs.map(toTabState);
    if (tabs.length === 0) {
      tabs = [newScratch(data.settings)];
    }
    const activeTabId = tabs.some((tab) => tab.id === data.activeTabId)
      ? data.activeTabId
      : tabs[0].id;
    applyAppearance(data.settings.theme, data.settings.accent);
    set({
      data,
      tabs,
      activeTabId,
      hydrated: true,
      loadWarning: warning,
    });
  },

  dismissLoadWarning: () => set({ loadWarning: null }),

  setTheme: (theme) => {
    applyAppearance(theme, get().data.settings.accent);
    set((state) => ({
      data: { ...state.data, settings: { ...state.data.settings, theme } },
    }));
  },

  setAccent: (accent) => {
    applyAppearance(get().data.settings.theme, accent);
    set((state) => ({
      data: { ...state.data, settings: { ...state.data.settings, accent } },
    }));
  },

  updateSettings: (patch) =>
    set((state) => {
      const settings = { ...state.data.settings, ...patch };
      if (patch.theme || patch.accent) {
        applyAppearance(settings.theme, settings.accent);
      }
      return { data: { ...state.data, settings } };
    }),

  setLayout: (key, sizes) =>
    set((state) => ({
      data: {
        ...state.data,
        layout: { ...state.data.layout, [key]: sizes },
      },
    })),

  setSidebarVisible: (visible) =>
    set((state) => ({
      data: {
        ...state.data,
        layout: { ...state.data.layout, sidebarVisible: visible },
      },
    })),

  setSelectedNode: (selectedNode) => set({ selectedNode }),
  setSearch: (search) => set({ search }),

  createScratchTab: (partial) => {
    const tab = newScratch(get().data.settings, partial);
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
      selectedNode: null,
    }));
    return tab.id;
  },

  openRequest: (requestId) => {
    const state = get();
    const existing = state.tabs.find((tab) => tab.savedRequestId === requestId);
    if (existing) {
      set({ activeTabId: existing.id, selectedNode: requestId });
      return;
    }
    const request = state.data.requests[requestId];
    if (!request) return;
    const tab: TabState = {
      ...tabFromRequest(cloneRequest(request), requestId),
      response: null,
      error: null,
      sending: false,
    };
    set({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
      selectedNode: requestId,
    });
  },

  openFromHistory: (historyId) => {
    const entry = get().data.history.find((item) => item.id === historyId);
    if (!entry) return;
    get().createScratchTab({
      ...cloneRequest(entry.request),
      name: autoTabName(entry.request.url),
    });
  },

  closeTab: (tabId) => {
    const state = get();
    const tab = state.tabs.find((item) => item.id === tabId);
    if (tab?.sending) void cancelRequest(tab.id);
    const index = state.tabs.findIndex((item) => item.id === tabId);
    const remaining = state.tabs.filter((item) => item.id !== tabId);
    const focusTabToken = state.focusTabToken + 1;
    if (remaining.length === 0) {
      const scratch = newScratch(state.data.settings);
      set({
        tabs: [scratch],
        activeTabId: scratch.id,
        selectedNode: null,
        focusTabToken,
      });
      return;
    }
    const activeTabId =
      state.activeTabId === tabId
        ? remaining[Math.max(0, index - 1)].id
        : state.activeTabId;
    set({ tabs: remaining, activeTabId, focusTabToken });
  },

  requestCloseTab: (tabId) => {
    const state = get();
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;
    if (!tab.dirty) {
      state.closeTab(tabId);
      return;
    }
    set({ pendingCloseTabId: tabId });
  },

  confirmCloseTab: () => {
    const pending = get().pendingCloseTabId;
    set({ pendingCloseTabId: null });
    if (pending) get().closeTab(pending);
  },

  cancelCloseTab: () => set({ pendingCloseTabId: null }),

  setActiveTab: (activeTabId) => {
    if (get().tabs.some((tab) => tab.id === activeTabId)) set({ activeTabId });
  },

  updateActiveRequest: (patch) => {
    const state = get();
    const tab = activeTabOf(state);
    if (!tab) return;
    const request: RequestDef = {
      ...tab.request,
      ...patch,
      body: patch.body ?? tab.request.body,
      auth: patch.auth ?? tab.request.auth,
      options: patch.options ?? tab.request.options,
      updatedAt: new Date().toISOString(),
    };
    if (tab.autoNamed) {
      request.name = autoTabName(request.url);
    }
    let data = state.data;
    if (tab.savedRequestId) {
      request.id = tab.savedRequestId;
      data = {
        ...state.data,
        requests: {
          ...state.data.requests,
          [tab.savedRequestId]: request,
        },
      };
    }
    set({
      data,
      tabs: state.tabs.map((item) =>
        item.id === tab.id
          ? {
              ...item,
              request,
              name: item.autoNamed
                ? request.name
                : (patch.name ?? item.name),
              dirty: item.savedRequestId ? false : true,
            }
          : item,
      ),
    });
  },

  sendActive: async () => {
    const state = get();
    const tab = activeTabOf(state);
    if (!tab || tab.sending) return;
    if (!isRequestUrlReady(tab.request.url)) {
      toastError(
        tab.request.url.trim()
          ? "Enter a full http:// or https:// URL"
          : "Enter a request URL",
      );
      if (typeof document !== "undefined") {
        document
          .querySelector<HTMLInputElement>("[data-request-url]")
          ?.focus();
      }
      return;
    }
    const environment =
      state.data.environments.find((env) => env.id === state.data.activeEnvId) ??
      null;
    const { spec, unresolved } = buildRequestSpec(
      tab.request,
      environment,
      state.data.settings,
    );
    if (unresolved.length > 0) {
      toastError(
        "Unresolved variables",
        `${unresolved.join(", ")} ${unresolved.length === 1 ? "is" : "are"} not defined in the active environment.`,
      );
    }
    const requestSpec = { ...spec, id: tab.id };
    const patchTab = (patch: Partial<TabState>) =>
      set((current) => ({
        tabs: current.tabs.map((item) =>
          item.id === tab.id ? { ...item, ...patch } : item,
        ),
      }));
    patchTab({ sending: true, response: null, error: null });

    const recordHistory = (entry: HistoryEntry) =>
      set((current) => ({
        data: {
          ...current.data,
          history: [entry, ...current.data.history].slice(0, 300),
        },
      }));

    try {
      const response = await sendRequest(requestSpec);
      recordHistory({
        id: uid(),
        method: tab.request.method,
        url: tab.request.url,
        status: response.status,
        timeMs: response.totalMs,
        sizeBytes: response.sizeBytes,
        at: new Date().toISOString(),
        request: cloneRequest(tab.request),
      });
      if (!get().tabs.some((item) => item.id === tab.id)) return;
      patchTab({ sending: false, response, error: null });
    } catch (error) {
      const normalized = normalizeRequestError(error);
      if (normalized.kind !== "cancelled") {
        recordHistory({
          id: uid(),
          method: tab.request.method,
          url: tab.request.url,
          status: null,
          timeMs: null,
          sizeBytes: null,
          at: new Date().toISOString(),
          request: cloneRequest(tab.request),
        });
      }
      if (!get().tabs.some((item) => item.id === tab.id)) return;
      patchTab({ sending: false, response: null, error: normalized });
    }
  },

  cancelActive: async () => {
    const tab = activeTabOf(get());
    if (!tab?.sending) return;
    set((state) => ({
      tabs: state.tabs.map((item) =>
        item.id === tab.id
          ? {
              ...item,
              sending: false,
              error: {
                kind: "cancelled",
                message: "The request was cancelled.",
              },
            }
          : item,
      ),
    }));
    await cancelRequest(tab.id);
  },

  dismissActiveError: () =>
    set((state) => ({
      tabs: state.tabs.map((item) =>
        item.id === state.activeTabId
          ? { ...item, response: null, error: null }
          : item,
      ),
    })),

  openSaveDialog: () => {
    if (activeTabOf(get())) set({ saveDialogOpen: true });
  },
  closeSaveDialog: () => set({ saveDialogOpen: false }),

  saveActiveTab: (name, targetId) => {
    const state = get();
    const tab = activeTabOf(state);
    const trimmed = name.trim();
    if (!tab || !trimmed) return false;
    const now = new Date().toISOString();
    let collections = state.data.collections;
    let target = targetId ? findTarget(collections, targetId) : null;
    if (!target) {
      if (collections.length === 0) {
        const collection: Collection = {
          id: uid(),
          name: "My requests",
          children: [],
        };
        collections = [collection];
        target = collection;
      } else {
        target = collections[0];
      }
    }
    const requests = { ...state.data.requests };
    let requestId = tab.savedRequestId ?? tab.request.id;
    if (!tab.savedRequestId && requests[requestId]) requestId = uid();
    const request: RequestDef = {
      ...tab.request,
      id: requestId,
      name: trimmed,
      updatedAt: now,
    };
    requests[requestId] = request;
    const node: TreeNode = { type: "request", id: uid(), requestId };
    collections = appendChild(collections, target.id, node);
    set({
      data: { ...state.data, collections, requests },
      tabs: state.tabs.map((item) =>
        item.id === tab.id
          ? {
              ...item,
              name: trimmed,
              request,
              savedRequestId: requestId,
              dirty: false,
              autoNamed: false,
            }
          : item,
      ),
      selectedNode: requestId,
      saveDialogOpen: false,
    });
    toastSuccess("Request saved", trimmed);
    return true;
  },

  renameTab: (tabId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const state = get();
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;
    if (tab.savedRequestId) {
      get().renameNode(tab.savedRequestId, trimmed);
      return;
    }
    set({
      tabs: state.tabs.map((item) =>
        item.id === tabId
          ? {
              ...item,
              name: trimmed,
              request: { ...item.request, name: trimmed },
              autoNamed: false,
            }
          : item,
      ),
    });
  },

  duplicateActive: () => {
    const tab = activeTabOf(get());
    if (!tab) return;
    if (tab.savedRequestId) {
      get().duplicateRequest(tab.savedRequestId);
      return;
    }
    get().createScratchTab({
      ...cloneRequest(tab.request),
      name: `${tab.name} copy`,
    });
  },

  deleteActiveSaved: () => {
    const tab = activeTabOf(get());
    if (!tab?.savedRequestId) return;
    const found = findRequestNode(get().data.collections, tab.savedRequestId);
    if (found) get().deleteNode(found.node.id);
  },

  duplicateRequest: (requestId) => {
    const state = get();
    const found = findRequestNode(state.data.collections, requestId);
    const source = state.data.requests[requestId];
    if (!found || !source) return;
    const copy = cloneRequest(source);
    copy.id = uid();
    copy.name = `${source.name} copy`;
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    const collections = appendChild(state.data.collections, found.parent.id, {
      type: "request",
      id: uid(),
      requestId: copy.id,
    });
    set({
      data: {
        ...state.data,
        collections,
        requests: { ...state.data.requests, [copy.id]: copy },
      },
    });
    toastSuccess("Request duplicated", copy.name);
    get().openRequest(copy.id);
  },

  createCollection: (name) => {
    const id = uid();
    set((state) => ({
      data: {
        ...state.data,
        collections: [
          ...state.data.collections,
          { id, name: name.trim() || "New collection", children: [] },
        ],
      },
    }));
    return id;
  },

  createFolder: (parentId, name) => {
    const target = findTarget(get().data.collections, parentId);
    if (!target) return null;
    const id = uid();
    set((state) => ({
      data: {
        ...state.data,
        collections: appendChild(state.data.collections, parentId, {
          type: "folder",
          id,
          name: name.trim() || "New folder",
          children: [],
        } as FolderNode),
      },
      selectedNode: id,
    }));
    return id;
  },

  renameNode: (nodeId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const state = get();
    const requestFound = findRequestNode(state.data.collections, nodeId);
    if (requestFound) {
      const request = {
        ...state.data.requests[nodeId],
        name: trimmed,
        updatedAt: new Date().toISOString(),
      };
      if (!request.id) return;
      set({
        data: {
          ...state.data,
          requests: { ...state.data.requests, [nodeId]: request },
        },
        tabs: state.tabs.map((tab) =>
          tab.savedRequestId === nodeId
            ? { ...tab, name: trimmed, request: { ...tab.request, name: trimmed } }
            : tab,
        ),
      });
      return;
    }
    set((state) => ({
      data: {
        ...state.data,
        collections: renameNode(state.data.collections, nodeId, trimmed),
      },
    }));
  },

  deleteNode: (nodeId) => {
    const state = get();
    const requestNode = findRequestNode(state.data.collections, nodeId);
    const { collections, requestIds, removed } = removeNode(
      state.data.collections,
      requestNode?.node.id ?? nodeId,
    );
    if (!removed) return;
    const requests = { ...state.data.requests };
    for (const id of requestIds) delete requests[id];
    const removedTabs = state.tabs.filter(
      (tab) => tab.savedRequestId && requestIds.includes(tab.savedRequestId),
    );
    for (const tab of removedTabs) {
      if (tab.sending) void cancelRequest(tab.id);
    }
    let tabs = state.tabs.filter(
      (tab) => !(tab.savedRequestId && requestIds.includes(tab.savedRequestId)),
    );
    let activeTabId = state.activeTabId;
    if (removedTabs.some((tab) => tab.id === state.activeTabId)) {
      if (tabs.length === 0) {
        const scratch = newScratch(state.data.settings);
        tabs = [scratch];
        activeTabId = scratch.id;
      } else {
        activeTabId = tabs[0].id;
      }
    }
    if (tabs.length === 0) {
      const scratch = newScratch(state.data.settings);
      tabs = [scratch];
      activeTabId = scratch.id;
    }
    set({
      data: { ...state.data, collections, requests },
      tabs,
      activeTabId,
      selectedNode: null,
    });
    toastSuccess(
      requestIds.length === 1 ? "Request deleted" : "Removed from workspace",
    );
  },

  setActiveEnvironment: (id) => {
    const state = get();
    if (id !== null && !state.data.environments.some((env) => env.id === id)) {
      return;
    }
    set({ data: { ...state.data, activeEnvId: id } });
  },

  addEnvironment: () => {
    const id = uid();
    const environment: Environment = {
      id,
      name: "New environment",
      vars: [],
    };
    set((state) => ({
      data: {
        ...state.data,
        environments: [...state.data.environments, environment],
        activeEnvId: id,
      },
    }));
    return id;
  },

  updateEnvironment: (id, patch) =>
    set((state) => ({
      data: {
        ...state.data,
        environments: state.data.environments.map((env) =>
          env.id === id ? { ...env, ...patch } : env,
        ),
      },
    })),

  deleteEnvironment: (id) =>
    set((state) => ({
      data: {
        ...state.data,
        environments: state.data.environments.filter((env) => env.id !== id),
        activeEnvId:
          state.data.activeEnvId === id ? null : state.data.activeEnvId,
      },
    })),

  clearHistory: () => {
    const previous = get().data.history;
    if (previous.length === 0) return;
    set((state) => ({
      data: { ...state.data, history: [] },
    }));
    toastSuccess("History cleared", undefined, {
      label: "Undo",
      onAction: () => {
        set((state) => ({
          data: { ...state.data, history: previous },
        }));
      },
    });
  },

  replaceData: (raw) => {
    const data = migrate(raw);
    let tabs = data.tabs.map(toTabState);
    if (tabs.length === 0) tabs = [newScratch(data.settings)];
    const activeTabId = tabs.some((tab) => tab.id === data.activeTabId)
      ? data.activeTabId
      : tabs[0].id;
    applyAppearance(data.settings.theme, data.settings.accent);
    set({
      data,
      tabs,
      activeTabId,
      selectedNode: null,
      saveDialogOpen: false,
      loadWarning: null,
    });
    toastSuccess("Workspace restored");
  },
}));
