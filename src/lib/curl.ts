import type {
  AuthDef,
  KV,
  Method,
  RequestDef,
} from "../types";
import { METHODS } from "../types";
import { base64EncodeUnicode, uid } from "./format";

export interface ParsedCurl {
  method: Method;
  url: string;
  headers: KV[];
  body: RequestDef["body"];
  auth: AuthDef;
  options: RequestDef["options"];
  warnings: string[];
}

export interface CurlParseResult {
  parsed: ParsedCurl | null;
  error: string | null;
}

function kv(key: string, value: string): KV {
  return { id: uid(), enabled: true, key, value };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let hasToken = false;
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quote === "'") {
      if (char === "'") {
        quote = null;
      } else {
        current += char;
      }
      hasToken = true;
      continue;
    }
    if (quote === '"') {
      if (char === '"') {
        quote = null;
      } else if (char === "\\" && index + 1 < input.length) {
        const next = input[index + 1];
        if (next === "\n") {
          index += 1;
        } else {
          current += next;
          index += 1;
        }
      } else {
        current += char;
      }
      hasToken = true;
      continue;
    }
    if (/\s/.test(char)) {
      if (hasToken) {
        tokens.push(current);
        current = "";
        hasToken = false;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      hasToken = true;
      continue;
    }
    if (char === "\\" && index + 1 < input.length) {
      const next = input[index + 1];
      if (next !== "\n") current += next;
      index += 1;
      hasToken = true;
      continue;
    }
    current += char;
    hasToken = true;
  }
  if (hasToken) tokens.push(current);
  return tokens;
}

function splitHeader(header: string): KV | null {
  const index = header.indexOf(":");
  if (index <= 0) return null;
  return kv(header.slice(0, index).trim(), header.slice(index + 1).trim());
}

function emptyBody(): RequestDef["body"] {
  return { mode: "none", content: "", fields: [] };
}

function emptyAuth(): AuthDef {
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

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (!/^[[{"\d]|^(true|false|null)$/.test(trimmed)) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function parsePair(text: string): KV {
  const index = text.indexOf("=");
  if (index === -1) return kv(text, "");
  return kv(text.slice(0, index), text.slice(index + 1));
}

export function parseCurl(input: string): CurlParseResult {
  const tokens = tokenize(input.trim());
  if (tokens.length === 0) return { parsed: null, error: "Paste a cURL command first." };
  if (tokens[0].toLowerCase() !== "curl") {
    return { parsed: null, error: "The command must start with curl." };
  }

  const warnings: string[] = [];
  const headers: KV[] = [];
  const dataParts: string[] = [];
  const encodedParts: string[] = [];
  let method: string | undefined;
  let url: string | undefined;
  let user: string | undefined;
  let insecure = false;
  let follow = false;
  let maxTime: number | undefined;
  let useGet = false;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = () => tokens[++index];
    switch (token) {
      case "-X":
      case "--request":
        method = (next() ?? "").toUpperCase();
        break;
      case "-H":
      case "--header": {
        const header = splitHeader(next() ?? "");
        if (header) headers.push(header);
        break;
      }
      case "-d":
      case "--data":
      case "--data-raw":
      case "--data-binary":
      case "--data-ascii":
        dataParts.push(next() ?? "");
        break;
      case "--data-urlencode":
        encodedParts.push(next() ?? "");
        break;
      case "-u":
      case "--user":
        user = next() ?? "";
        break;
      case "--url":
        url = next() ?? "";
        break;
      case "-k":
      case "--insecure":
        insecure = true;
        break;
      case "-L":
      case "--location":
        follow = true;
        break;
      case "--max-time": {
        const seconds = Number(next());
        if (Number.isFinite(seconds) && seconds > 0) maxTime = Math.round(seconds * 1000);
        break;
      }
      case "-G":
      case "--get":
        useGet = true;
        break;
      case "-I":
      case "--head":
        method = "HEAD";
        break;
      case "-A":
      case "--user-agent": {
        const value = next();
        if (value !== undefined) headers.push(kv("User-Agent", value));
        break;
      }
      case "-b":
      case "--cookie": {
        const value = next();
        if (value !== undefined) headers.push(kv("Cookie", value));
        break;
      }
      case "-e":
      case "--referer": {
        const value = next();
        if (value !== undefined) headers.push(kv("Referer", value));
        break;
      }
      case "-o":
      case "--output":
      case "-x":
      case "--proxy":
      case "--connect-timeout":
        next();
        break;
      case "-F":
      case "--form":
      case "--form-string":
        return {
          parsed: null,
          error: "Multipart form uploads aren't supported in Payload yet.",
        };
      case "--compressed":
      case "-N":
      case "--no-buffer":
        break;
      default:
        if (token.startsWith("-")) {
          if (![
            "--http1.1",
            "--http2",
            "--http2-prior-knowledge",
            "--globoff",
            "-s",
            "--silent",
            "-i",
            "--include",
            "-v",
            "--verbose",
            "-f",
            "--fail",
            "--raw",
            "-g",
          ].includes(token)) {
            warnings.push(`Ignored unsupported flag ${token}.`);
          }
        } else if (!url) {
          url = token;
        }
        break;
    }
  }

  if (!url) return { parsed: null, error: "No URL found in the cURL command." };

  const headerFor = (name: string) =>
    headers.find((header) => header.key.toLowerCase() === name.toLowerCase());
  const contentType = headerFor("content-type")?.value.toLowerCase() ?? "";
  let body = emptyBody();

  const rawData = dataParts.join("&");
  if (encodedParts.length > 0) {
    body = {
      mode: "form",
      content: rawData,
      fields: encodedParts.map(parsePair),
    };
    for (const part of dataParts) {
      const pair = parsePair(part);
      if (pair.key) body.fields.push(pair);
    }
  } else if (rawData) {
    if (contentType.includes("json") || looksLikeJson(rawData)) {
      body = { mode: "json", content: rawData, fields: [] };
    } else if (
      contentType.includes("x-www-form-urlencoded") ||
      (!contentType && rawData.includes("=") && !rawData.trim().startsWith("<"))
    ) {
      body = {
        mode: "form",
        content: rawData,
        fields: rawData.split("&").filter(Boolean).map(parsePair),
      };
    } else {
      body = { mode: "text", content: rawData, fields: [] };
    }
  }

  const auth = emptyAuth();
  if (user !== undefined) {
    const separator = user.indexOf(":");
    auth.type = "basic";
    auth.username = separator === -1 ? user : user.slice(0, separator);
    auth.password = separator === -1 ? "" : user.slice(separator + 1);
  }

  let finalMethod = method ?? (body.mode !== "none" && !useGet ? "POST" : "GET");
  if (useGet) finalMethod = "GET";
  if (!METHODS.includes(finalMethod as Method)) {
    warnings.push(`Method ${finalMethod} isn't supported; imported as GET.`);
    finalMethod = "GET";
  }

  if (!/^https?:\/\//i.test(url)) {
    warnings.push("The URL has no http:// or https:// scheme. Rust may reject it.");
  }

  return {
    parsed: {
      method: finalMethod as Method,
      url,
      headers,
      body,
      auth,
      options: {
        timeoutMs: maxTime ?? 30_000,
        followRedirects: follow,
        verifyTls: !insecure,
      },
      warnings,
    },
    error: null,
  };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function encodeKeepingVariables(value: string): string {
  return encodeURIComponent(value)
    .replace(/%7B%7B/g, "{{")
    .replace(/%7D%7D/g, "}}");
}

function appendQuery(url: string, key: string, value: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${encodeKeepingVariables(key)}=${encodeKeepingVariables(value)}`;
}

export function toCurl(request: RequestDef): string {
  const lines = [`curl --request ${request.method}`];
  let url = request.url.trim();

  for (const param of request.params) {
    if (param.enabled && param.key) url = appendQuery(url, param.key, param.value);
  }

  const headers = request.headers
    .filter((header) => header.enabled && header.key)
    .map((header) => ({ key: header.key, value: header.value }));
  const auth = request.auth;
  if (
    auth.type === "bearer" &&
    auth.token &&
    !headers.some((header) => header.key.toLowerCase() === "authorization")
  ) {
    headers.push({ key: "Authorization", value: `Bearer ${auth.token}` });
  } else if (
    auth.type === "basic" &&
    (auth.username || auth.password) &&
    !headers.some((header) => header.key.toLowerCase() === "authorization")
  ) {
    headers.push({
      key: "Authorization",
      value: `Basic ${base64EncodeUnicode(`${auth.username}:${auth.password}`)}`,
    });
  } else if (auth.type === "apiKey" && auth.key) {
    if (auth.in === "query") {
      url = appendQuery(url, auth.key, auth.value);
    } else if (!headers.some((header) => header.key.toLowerCase() === auth.key.toLowerCase())) {
      headers.push({ key: auth.key, value: auth.value });
    }
  }

  if (request.body.mode === "json" || request.body.mode === "text") {
    if (
      request.body.content &&
      !headers.some((header) => header.key.toLowerCase() === "content-type")
    ) {
      headers.push({
        key: "Content-Type",
        value:
          request.body.mode === "json"
            ? "application/json"
            : "text/plain; charset=utf-8",
      });
    }
  } else if (request.body.mode === "form" && request.body.fields.length > 0) {
    if (!headers.some((header) => header.key.toLowerCase() === "content-type")) {
      headers.push({
        key: "Content-Type",
        value: "application/x-www-form-urlencoded",
      });
    }
  }

  for (const header of headers) {
    lines.push(`--header ${shellQuote(`${header.key}: ${header.value}`)}`);
  }

  if (request.body.mode === "json" || request.body.mode === "text") {
    if (request.body.content) lines.push(`--data-raw ${shellQuote(request.body.content)}`);
  } else if (request.body.mode === "form") {
    for (const field of request.body.fields) {
      if (field.enabled && field.key) {
        lines.push(`--data-urlencode ${shellQuote(`${field.key}=${field.value}`)}`);
      }
    }
  }

  if (!request.options.verifyTls) lines.push("--insecure");
  if (request.options.followRedirects) lines.push("--location");
  if (request.options.timeoutMs > 0) {
    lines.push(`--max-time ${Math.ceil(request.options.timeoutMs / 1000)}`);
  }
  lines.push(shellQuote(url));

  return lines.join(" \\\n  ");
}
