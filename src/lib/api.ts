import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { RequestError, RequestSpec, ResponseData } from "../types";
import { prettyJson } from "./format";

export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const MOCK_STORAGE_KEY = "payload.mock.appdata";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

const TINY_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

const mockCancels = new Set<string>();

function mockDelay(ms: number, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (mockCancels.has(id)) {
        mockCancels.delete(id);
        reject({ kind: "cancelled", message: "The request was cancelled." });
        return;
      }
      if (Date.now() - started >= ms) {
        resolve();
        return;
      }
      setTimeout(tick, Math.min(40, ms));
    };
    tick();
  });
}

async function mockSend(spec: RequestSpec): Promise<ResponseData> {
  const started = performance.now();
  const url = new URL(spec.url);
  for (const param of spec.params) {
    if (param.enabled && param.key) url.searchParams.append(param.key, param.value);
  }
  const path = url.pathname;
  const delayMatch = /delay\/(\d+(?:\.\d+)?)/.exec(path);
  if (delayMatch) {
    await mockDelay(Number(delayMatch[1]) * 1000, spec.id);
  } else {
    await mockDelay(120, spec.id);
  }
  if (mockCancels.has(spec.id)) {
    mockCancels.delete(spec.id);
    throw { kind: "cancelled", message: "The request was cancelled." };
  }

  const statusMatch = /status\/(\d{3})/.exec(path);
  let status = statusMatch ? Number(statusMatch[1]) : 200;
  let contentType = "application/json";
  let bodyText: string | undefined = "";
  let bodyBase64: string | undefined;
  const headers = [
    { name: "content-type", value: contentType },
    { name: "x-payload-mock", value: "true" },
    { name: "set-cookie", value: "payload_session=mock; Path=/; HttpOnly" },
  ];

  if (path.includes("html")) {
    contentType = "text/html; charset=utf-8";
    headers[0].value = contentType;
    bodyText =
      "<!doctype html><html><body style=\"font-family: system-ui; padding: 24px\"><h1>Mock HTML</h1><p>Sandboxed preview. Scripts don't run.</p><script>alert('nope')</script></body></html>";
  } else if (path.includes("image")) {
    contentType = "image/png";
    headers[0].value = contentType;
    bodyBase64 = bytesToBase64(TINY_PNG);
  } else if (path.includes("redirect") && !spec.followRedirects) {
    status = 302;
    headers.push({ name: "location", value: "/redirected" });
    bodyText = "";
  } else if (status === 204) {
    bodyText = undefined;
  } else {
    bodyText = prettyJson(
      JSON.stringify(
        {
          method: spec.method,
          url: url.toString(),
          path,
          args: Object.fromEntries(url.searchParams.entries()),
          headers: Object.fromEntries(
            spec.headers
              .filter((header) => header.enabled && header.key)
              .map((header) => [header.key, header.value]),
          ),
          json:
            spec.body.mode === "json" && spec.body.content
              ? (() => {
                  try {
                    return JSON.parse(spec.body.content);
                  } catch {
                    return spec.body.content;
                  }
                })()
              : null,
          form:
            spec.body.mode === "form"
              ? Object.fromEntries(
                  spec.body.fields
                    .filter((field) => field.enabled && field.key)
                    .map((field) => [field.key, field.value]),
                )
              : null,
          text: spec.body.mode === "text" ? spec.body.content : null,
          note: "Browser preview response. The desktop app performs real HTTP via Rust.",
        },
        null,
        2,
      ),
    );
  }

  const finalUrl = path.includes("redirect") && spec.followRedirects
    ? new URL("/redirected", url).toString()
    : url.toString();
  const sizeBytes = bodyText
    ? new TextEncoder().encode(bodyText).byteLength
    : bodyBase64
      ? Math.floor((bodyBase64.length * 3) / 4)
      : 0;
  const total = performance.now() - started;

  return {
    status,
    statusText:
      status === 302
        ? "Found"
        : status === 404
          ? "Not Found"
          : status === 500
            ? "Internal Server Error"
            : status === 204
              ? "No Content"
              : "OK",
    httpVersion: "HTTP/2",
    finalUrl,
    contentType,
    headers,
    bodyText,
    bodyBase64,
    sizeBytes,
    truncated: false,
    ttfbMs: Math.max(1, Math.round(total * 0.7)),
    totalMs: Math.max(1, Math.round(total)),
  };
}

export function normalizeRequestError(error: unknown): RequestError {
  const kinds: RequestError["kind"][] = [
    "invalid_url",
    "dns",
    "connect",
    "timeout",
    "tls",
    "cancelled",
    "other",
  ];
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const kind = kinds.includes(record.kind as RequestError["kind"])
      ? (record.kind as RequestError["kind"])
      : "other";
    return {
      kind,
      message:
        typeof record.message === "string" ? record.message : "Request failed.",
    };
  }
  if (error instanceof Error) return { kind: "other", message: error.message };
  return { kind: "other", message: String(error) };
}

export async function sendRequest(spec: RequestSpec): Promise<ResponseData> {
  if (!isTauri) return mockSend(spec);
  try {
    return await invoke<ResponseData>("send_request", { spec });
  } catch (error) {
    throw normalizeRequestError(error);
  }
}

export async function cancelRequest(id: string): Promise<void> {
  if (!isTauri) {
    mockCancels.add(id);
    return;
  }
  try {
    await invoke("cancel_request", { id });
  } catch {
    // The request may have completed between pressing Cancel and the IPC call.
  }
}

export async function clearCookies(): Promise<void> {
  if (!isTauri) return;
  await invoke("clear_cookies");
}

export async function loadAppData(): Promise<unknown | null> {
  if (!isTauri) {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  }
  return invoke<unknown | null>("load_app_data");
}

export async function saveAppData(data: unknown): Promise<void> {
  if (!isTauri) {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
    return;
  }
  await invoke("save_app_data", { data });
}

export async function appDataPath(): Promise<string> {
  if (!isTauri) return "Browser preview — data saved in localStorage";
  return invoke<string>("app_data_path");
}

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path });
}

export async function writeTextFile(
  path: string,
  contents: string,
): Promise<void> {
  return invoke("write_text_file", { path, contents });
}

export async function pickSavePath(defaultName: string): Promise<string | null> {
  if (!isTauri) return null;
  return save({ defaultPath: defaultName });
}

export async function pickOpenPath(): Promise<string | null> {
  if (!isTauri) return null;
  return open({ multiple: false, directory: false });
}

function browserDownload(name: string, contents: string | Blob) {
  const blob =
    contents instanceof Blob
      ? contents
      : new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function saveTextAs(
  defaultName: string,
  contents: string,
): Promise<void> {
  if (!isTauri) {
    browserDownload(defaultName, contents);
    return;
  }
  const path = await save({ defaultPath: defaultName });
  if (path) await writeTextFile(path, contents);
}

export async function saveBase64As(
  defaultName: string,
  base64: string,
  mime: string,
): Promise<void> {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  if (!isTauri) {
    browserDownload(defaultName, new Blob([bytes], { type: mime }));
    return;
  }
  const path = await save({ defaultPath: defaultName });
  if (!path) return;
  const text = new TextDecoder("latin1").decode(bytes);
  await writeTextFile(path, text);
}

export function resetMockData(): void {
  localStorage.removeItem(MOCK_STORAGE_KEY);
  mockCancels.clear();
}
