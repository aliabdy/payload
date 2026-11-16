import type { Method, RequestError, ResponseData } from "../types";

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return "-";
  if (ms < 1) return "<1 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function isJsonResponse(response: ResponseData): boolean {
  const type = response.contentType?.toLowerCase() ?? "";
  if (type.includes("json")) return true;
  const start = response.bodyText?.trimStart();
  return !!start && (start.startsWith("{") || start.startsWith("["));
}

export function errorTitle(error: RequestError): string {
  const titles: Record<RequestError["kind"], string> = {
    invalid_url: "Invalid URL",
    dns: "Could not resolve host",
    connect: "Connection failed",
    timeout: "Request timed out",
    tls: "TLS verification failed",
    cancelled: "Request cancelled",
    other: "Request failed",
  };
  return titles[error.kind];
}

export function methodClass(method: Method | string): string {
  return `method-badge method-${String(method).toLowerCase()}`;
}

export function statusClass(status: number): string {
  if (status >= 500) return "status-pill status-5xx";
  if (status >= 400) return "status-pill status-4xx";
  if (status >= 300) return "status-pill status-3xx";
  return "status-pill status-2xx";
}

export function truncateMiddle(text: string, max = 72): string {
  if (text.length <= max) return text;
  const half = Math.floor((max - 1) / 2);
  return `${text.slice(0, half)}…${text.slice(-half)}`;
}

export function base64EncodeUnicode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
