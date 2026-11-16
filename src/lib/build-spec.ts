import type {
  Environment,
  KV,
  RequestDef,
  RequestSpec,
  Settings,
} from "../types";
import { base64EncodeUnicode } from "./format";
import { resolveVariables } from "./variables";

function resolveKV(items: KV[], environment: Environment | null): KV[] {
  return items.map((item) => ({
    ...item,
    key: resolveVariables(item.key, environment).text,
    value: resolveVariables(item.value, environment).text,
  }));
}

export function buildRequestSpec(
  request: RequestDef,
  environment: Environment | null,
  settings: Settings,
): { spec: RequestSpec; unresolved: string[] } {
  const unresolved = new Set<string>();
  const resolvedUrl = resolveVariables(request.url, environment);
  resolvedUrl.unresolved.forEach((name) => unresolved.add(name));

  const headers = resolveKV(request.headers, environment);
  const params = resolveKV(request.params, environment);
  for (const item of [...request.headers, ...request.params]) {
    resolveVariables(item.value, environment).unresolved.forEach((name) =>
      unresolved.add(name),
    );
  }
  const content = resolveVariables(request.body.content, environment);
  content.unresolved.forEach((name) => unresolved.add(name));
  const fields = resolveKV(request.body.fields, environment);

  const auth = request.auth;
  const secret = (value: string) => resolveVariables(value, environment).text;
  if (auth.type === "bearer" && auth.token) {
    headers.push({
      id: "auth-header",
      enabled: true,
      key: "Authorization",
      value: `Bearer ${secret(auth.token)}`,
    });
  } else if (auth.type === "basic" && (auth.username || auth.password)) {
    headers.push({
      id: "auth-header",
      enabled: true,
      key: "Authorization",
      value: `Basic ${base64EncodeUnicode(`${secret(auth.username)}:${secret(auth.password)}`)}`,
    });
  } else if (auth.type === "apiKey" && auth.key) {
    const pair = {
      id: "auth-key",
      enabled: true,
      key: secret(auth.key),
      value: secret(auth.value),
    };
    if (auth.in === "query") params.push(pair);
    else headers.push(pair);
  }

  return {
    spec: {
      id: request.id,
      method: request.method,
      url: resolvedUrl.text,
      params,
      headers,
      body: {
        mode: request.body.mode,
        content: content.text,
        fields,
      },
      timeoutMs: request.options.timeoutMs || settings.timeoutMs || 30_000,
      followRedirects: request.options.followRedirects,
      verifyTls: request.options.verifyTls,
      proxy: settings.proxy.trim() || null,
    },
    unresolved: [...unresolved],
  };
}
