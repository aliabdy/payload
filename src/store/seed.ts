import type {
  AppData,
  AuthDef,
  Collection,
  Environment,
  KV,
  PersistedTab,
  RequestDef,
  TreeNode,
} from "../types";
import { truncateMiddle, uid } from "../lib/format";

export function kv(key = "", value = ""): KV {
  return { id: uid(), enabled: true, key, value };
}

export function defaultAuth(): AuthDef {
  return {
    type: "none",
    token: "",
    username: "",
    password: "",
    key: "",
    value: "",
    in: "header",
  };
}

export function blankRequest(overrides: Partial<RequestDef> = {}): RequestDef {
  const now = new Date().toISOString();
  const base: RequestDef = {
    id: uid(),
    name: "Untitled request",
    method: "GET",
    url: "",
    params: [],
    headers: [],
    body: { mode: "none", content: "", fields: [] },
    auth: defaultAuth(),
    options: { timeoutMs: 30_000, followRedirects: true, verifyTls: true },
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...base,
    ...overrides,
    body: overrides.body ?? base.body,
    auth: overrides.auth ?? base.auth,
    options: overrides.options ?? base.options,
  };
}

export function tabFromRequest(
  request: RequestDef,
  savedRequestId: string | null,
): PersistedTab {
  return {
    id: uid(),
    name: request.name,
    request,
    savedRequestId,
    dirty: savedRequestId === null,
  };
}

export function autoTabName(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "New request";
  let path = trimmed;
  try {
    const parsed = new URL(trimmed);
    path = `${parsed.pathname}${parsed.search}` || "/";
  } catch {
    const template = trimmed.match(/^\{\{[^}]+\}\}(.*)$/);
    if (template) path = template[1] || "/";
  }
  return truncateMiddle(path, 60);
}

export function defaultLayout(): AppData["layout"] {
  return { sidebar: [22, 78], split: [53, 47], sidebarVisible: true };
}

export function seedData(): AppData {
  const getRequest = {
    ...blankRequest({
      name: "HTTPBin GET",
      method: "GET",
      url: "https://httpbingo.org/get",
    }),
  };
  const postRequest = blankRequest({
    name: "Echo JSON body",
    method: "POST",
    url: "https://httpbingo.org/anything",
    headers: [kv("Accept", "application/json")],
    body: {
      mode: "json",
      content: '{\n  "hello": "payload",\n  "from": "personal-api-client"\n}',
      fields: [],
    },
  });
  const notFoundRequest = blankRequest({
    name: "Not found",
    method: "GET",
    url: "https://httpbingo.org/status/404",
  });
  const delayRequest = blankRequest({
    name: "Slow response (2s)",
    method: "GET",
    url: "https://httpbingo.org/delay/2",
  });
  const environment: Environment = {
    id: uid(),
    name: "Local dev",
    vars: [
      kv("baseUrl", "http://localhost:3000"),
      kv("apiKey", "dev-secret"),
    ],
  };
  const collectionId = uid();
  const folderId = uid();
  const requests: Record<string, RequestDef> = {
    [getRequest.id]: getRequest,
    [postRequest.id]: postRequest,
    [notFoundRequest.id]: notFoundRequest,
    [delayRequest.id]: delayRequest,
  };
  const folder: TreeNode = {
    type: "folder",
    id: folderId,
    name: "Examples",
    children: [
      { type: "request", id: uid(), requestId: getRequest.id },
      { type: "request", id: uid(), requestId: postRequest.id },
    ],
  };
  const collections: Collection[] = [
    {
      id: collectionId,
      name: "Welcome",
      children: [
        folder,
        { type: "request", id: uid(), requestId: notFoundRequest.id },
        { type: "request", id: uid(), requestId: delayRequest.id },
      ],
    },
  ];
  const tab = tabFromRequest({ ...getRequest }, getRequest.id);
  return {
    version: 1,
    collections,
    requests,
    environments: [environment],
    activeEnvId: environment.id,
    history: [],
    settings: {
      theme: "dark",
      accent: "teal",
      timeoutMs: 30_000,
      followRedirects: true,
      verifyTls: true,
      proxy: "",
    },
    tabs: [tab],
    activeTabId: tab.id,
    layout: defaultLayout(),
  };
}
