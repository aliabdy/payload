export type Method =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export const METHODS: Method[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

export interface KV {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
}

export type BodyMode = "none" | "json" | "text" | "form";

export type AuthType = "none" | "bearer" | "basic" | "apiKey";

export interface AuthDef {
  type: AuthType;
  token: string;
  username: string;
  password: string;
  key: string;
  value: string;
  in: "header" | "query";
}

export interface RequestDef {
  id: string;
  name: string;
  method: Method;
  url: string;
  params: KV[];
  headers: KV[];
  body: {
    mode: BodyMode;
    content: string;
    fields: KV[];
  };
  auth: AuthDef;
  options: {
    timeoutMs: number;
    followRedirects: boolean;
    verifyTls: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FolderNode {
  type: "folder";
  id: string;
  name: string;
  children: TreeNode[];
}

export interface RequestNode {
  type: "request";
  id: string;
  requestId: string;
}

export type TreeNode = FolderNode | RequestNode;

export interface Collection {
  id: string;
  name: string;
  children: TreeNode[];
}

export interface Environment {
  id: string;
  name: string;
  vars: KV[];
}

export interface HistoryEntry {
  id: string;
  method: Method;
  url: string;
  status: number | null;
  timeMs: number | null;
  sizeBytes: number | null;
  at: string;
  request: RequestDef;
}

export const ACCENTS = [
  "teal",
  "blue",
  "indigo",
  "violet",
  "amber",
  "rose",
] as const;

export type AccentColor = (typeof ACCENTS)[number];

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export interface Settings {
  theme: ThemePreference;
  accent: AccentColor;
  timeoutMs: number;
  followRedirects: boolean;
  verifyTls: boolean;
  proxy: string;
}

export interface AppData {
  version: 1;
  collections: Collection[];
  requests: Record<string, RequestDef>;
  environments: Environment[];
  activeEnvId: string | null;
  history: HistoryEntry[];
  settings: Settings;
  tabs: PersistedTab[];
  activeTabId: string;
  layout: {
    sidebar: number[];
    split: number[];
    sidebarVisible: boolean;
  };
}

export interface PersistedTab {
  id: string;
  name: string;
  request: RequestDef;
  savedRequestId: string | null;
  dirty: boolean;
  autoNamed?: boolean;
}

export interface TabState extends PersistedTab {
  response: ResponseData | null;
  error: RequestError | null;
  sending: boolean;
}

export interface ResponseData {
  status: number;
  statusText: string;
  httpVersion: string;
  finalUrl: string;
  contentType?: string;
  headers: { name: string; value: string }[];
  bodyText?: string;
  bodyBase64?: string;
  sizeBytes: number;
  truncated: boolean;
  ttfbMs: number;
  totalMs: number;
}

export interface RequestError {
  kind:
    | "invalid_url"
    | "dns"
    | "connect"
    | "timeout"
    | "tls"
    | "cancelled"
    | "other";
  message: string;
}

export interface RequestSpec {
  id: string;
  method: Method;
  url: string;
  params: KV[];
  headers: KV[];
  body: {
    mode: BodyMode;
    content: string;
    fields: KV[];
  };
  timeoutMs: number;
  followRedirects: boolean;
  verifyTls: boolean;
  proxy: string | null;
}
