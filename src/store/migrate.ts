import type {
  AccentColor,
  AppData,
  AuthDef,
  BodyMode,
  Collection,
  Environment,
  HistoryEntry,
  KV,
  Method,
  PersistedTab,
  RequestDef,
  Settings,
  TreeNode,
} from "../types";
import { ACCENTS, METHODS } from "../types";
import { uid } from "../lib/format";
import { blankRequest, defaultAuth, defaultLayout, autoTabName, seedData } from "./seed";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

function sanitizeKV(raw: unknown): KV {
  const record = isRecord(raw) ? raw : {};
  return {
    id: asString(record.id) || uid(),
    enabled: asBoolean(record.enabled, true),
    key: asString(record.key),
    value: asString(record.value),
  };
}

function sanitizeList(raw: unknown): KV[] {
  return Array.isArray(raw) ? raw.map(sanitizeKV) : [];
}

function sanitizeMethod(raw: unknown): Method {
  return METHODS.includes(raw as Method) ? (raw as Method) : "GET";
}

function sanitizeBody(raw: unknown): RequestDef["body"] {
  const record = isRecord(raw) ? raw : {};
  const modes: BodyMode[] = ["none", "json", "text", "form"];
  const mode = modes.includes(record.mode as BodyMode)
    ? (record.mode as BodyMode)
    : "none";
  return {
    mode,
    content: asString(record.content),
    fields: sanitizeList(record.fields),
  };
}

function sanitizeAuth(raw: unknown): AuthDef {
  const base = defaultAuth();
  if (!isRecord(raw)) return base;
  const types: AuthDef["type"][] = ["none", "bearer", "basic", "apiKey"];
  return {
    ...base,
    type: types.includes(raw.type as AuthDef["type"])
      ? (raw.type as AuthDef["type"])
      : "none",
    token: asString(raw.token),
    username: asString(raw.username),
    password: asString(raw.password),
    key: asString(raw.key),
    value: asString(raw.value),
    in: raw.in === "query" ? "query" : "header",
  };
}

export function sanitizeRequest(
  raw: unknown,
  fallbackId = uid(),
): RequestDef {
  const record = isRecord(raw) ? raw : {};
  const options = isRecord(record.options) ? record.options : {};
  return blankRequest({
    id: asString(record.id) || fallbackId,
    name: asString(record.name) || "Untitled request",
    method: sanitizeMethod(record.method),
    url: asString(record.url),
    params: sanitizeList(record.params),
    headers: sanitizeList(record.headers),
    body: sanitizeBody(record.body),
    auth: sanitizeAuth(record.auth),
    options: {
      timeoutMs: Math.min(
        600_000,
        Math.max(1_000, asNumber(options.timeoutMs, 30_000)),
      ),
      followRedirects: asBoolean(options.followRedirects, true),
      verifyTls: asBoolean(options.verifyTls, true),
    },
    createdAt: asString(record.createdAt, new Date().toISOString()),
    updatedAt: asString(record.updatedAt, new Date().toISOString()),
  });
}

function sanitizeTree(
  raw: unknown,
  requests: Record<string, RequestDef>,
): TreeNode | null {
  if (!isRecord(raw)) return null;
  if (raw.type === "request") {
    const requestId = asString(raw.requestId);
    if (!requestId || !requests[requestId]) return null;
    return { type: "request", id: asString(raw.id) || uid(), requestId };
  }
  if (raw.type === "folder") {
    const children = Array.isArray(raw.children)
      ? raw.children
          .map((child) => sanitizeTree(child, requests))
          .filter((child): child is TreeNode => child !== null)
      : [];
    return {
      type: "folder",
      id: asString(raw.id) || uid(),
      name: asString(raw.name) || "Folder",
      children,
    };
  }
  return null;
}

function sanitizeSettings(raw: unknown): Settings {
  const record = isRecord(raw) ? raw : {};
  return {
    theme:
      record.theme === "light" || record.theme === "system"
        ? record.theme
        : "dark",
    accent: ACCENTS.includes(record.accent as AccentColor)
      ? (record.accent as AccentColor)
      : "teal",
    timeoutMs: Math.min(600_000, Math.max(1_000, asNumber(record.timeoutMs, 30_000))),
    followRedirects: asBoolean(record.followRedirects, true),
    verifyTls: asBoolean(record.verifyTls, true),
    proxy: asString(record.proxy),
  };
}

function sanitizeEnvironment(raw: unknown): Environment | null {
  if (!isRecord(raw)) return null;
  return {
    id: asString(raw.id) || uid(),
    name: asString(raw.name) || "Environment",
    vars: sanitizeList(raw.vars),
  };
}

function sanitizeHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((record) => {
      const request = sanitizeRequest(record.request);
      return {
        id: asString(record.id) || uid(),
        method: sanitizeMethod(record.method ?? request.method),
        url: asString(record.url, request.url),
        status:
          typeof record.status === "number" && Number.isFinite(record.status)
            ? record.status
            : null,
        timeMs:
          typeof record.timeMs === "number" && Number.isFinite(record.timeMs)
            ? record.timeMs
            : null,
        sizeBytes:
          typeof record.sizeBytes === "number" && Number.isFinite(record.sizeBytes)
            ? record.sizeBytes
            : null,
        at: asString(record.at, new Date().toISOString()),
        request,
      };
    })
    .slice(0, 300);
}

function sanitizeLayout(raw: unknown): AppData["layout"] {
  const fallback = defaultLayout();
  if (!isRecord(raw)) return fallback;
  const pair = (value: unknown, preset: number[]) =>
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((entry) => typeof entry === "number" && entry > 0)
      ? (value as number[])
      : preset;
  return {
    sidebar: pair(raw.sidebar, fallback.sidebar),
    split: pair(raw.split, fallback.split),
    sidebarVisible: asBoolean(raw.sidebarVisible, true),
  };
}

function sanitizeTabs(
  raw: unknown,
  requests: Record<string, RequestDef>,
): PersistedTab[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const tabs: PersistedTab[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    let id = asString(entry.id) || uid();
    if (seen.has(id)) id = uid();
    seen.add(id);
    const request = sanitizeRequest(entry.request);
    const savedCandidate = asString(entry.savedRequestId);
    const savedRequestId =
      savedCandidate && requests[savedCandidate] ? savedCandidate : null;
    const source = savedRequestId ? requests[savedRequestId] : request;
    tabs.push({
      id,
      name: asString(entry.name) || source.name,
      request: savedRequestId ? { ...source } : request,
      savedRequestId,
      dirty: savedRequestId ? false : asBoolean(entry.dirty, true),
      autoNamed: savedRequestId ? false : asBoolean(entry.autoNamed, false),
    });
  }
  return tabs;
}

export function migrate(raw: unknown): AppData {
  if (!isRecord(raw)) throw new Error("Stored workspace is not a JSON object.");
  if (typeof raw.version === "number" && raw.version > 1) {
    throw new Error("This workspace was written by a newer version of Payload.");
  }
  if (
    !Array.isArray(raw.collections) ||
    !Array.isArray(raw.tabs) ||
    !Array.isArray(raw.environments) ||
    !isRecord(raw.requests)
  ) {
    throw new Error("Stored workspace is missing required fields.");
  }

  const requests: Record<string, RequestDef> = {};
  for (const [id, value] of Object.entries(raw.requests)) {
    requests[id] = sanitizeRequest(value, id);
  }

  const collections: Collection[] = raw.collections
    .filter(isRecord)
    .map((collection) => ({
      id: asString(collection.id) || uid(),
      name: asString(collection.name) || "Collection",
      children: Array.isArray(collection.children)
        ? collection.children
            .map((node) => sanitizeTree(node, requests))
            .filter((node): node is TreeNode => node !== null)
        : [],
    }));

  const environments = raw.environments
    .map(sanitizeEnvironment)
    .filter((env): env is Environment => env !== null);

  let tabs = sanitizeTabs(raw.tabs, requests);
  if (tabs.length === 0) {
    const request = blankRequest();
    request.name = autoTabName(request.url);
    tabs = [
      {
        id: uid(),
        name: request.name,
        request,
        savedRequestId: null,
        dirty: false,
        autoNamed: true,
      },
    ];
  }

  const activeTabId = tabs.some((tab) => tab.id === raw.activeTabId)
    ? (raw.activeTabId as string)
    : tabs[0].id;
  const activeEnvId =
    typeof raw.activeEnvId === "string" &&
    environments.some((env) => env.id === raw.activeEnvId)
      ? raw.activeEnvId
      : null;

  return {
    version: 1,
    collections,
    requests,
    environments,
    activeEnvId,
    history: sanitizeHistory(raw.history),
    settings: sanitizeSettings(raw.settings),
    tabs,
    activeTabId,
    layout: sanitizeLayout(raw.layout),
  };
}

export function fallbackData(): AppData {
  return seedData();
}
