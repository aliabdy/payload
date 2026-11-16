import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT ?? 8787);
const sessions = new Map();

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function json(response, status, value) {
  const body = JSON.stringify(value, null, 2);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

function collectCookies(request) {
  const header = request.headers.cookie ?? "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key]) => key)
      .map(([key, ...rest]) => [key, rest.join("=")]),
  );
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString("utf8");
  console.log(`${request.method} ${url.pathname}${url.search}`);

  const delayMatch = /^\/delay\/(\d+(?:\.\d+)?)$/.exec(url.pathname);
  if (delayMatch) {
    await new Promise((resolve) =>
      setTimeout(resolve, Number(delayMatch[1]) * 1000),
    );
    return json(response, 200, { delayedMs: Number(delayMatch[1]) * 1000 });
  }

  const statusMatch = /^\/status\/(\d{3})$/.exec(url.pathname);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    if (status === 204) {
      response.writeHead(204);
      return response.end();
    }
    return json(response, status, { status });
  }

  if (url.pathname === "/redirect") {
    response.writeHead(302, { location: "/echo" });
    return response.end();
  }

  if (url.pathname === "/set-cookie") {
    const session = randomUUID();
    sessions.set(session, Date.now());
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": `payload_session=${session}; Path=/; HttpOnly`,
    });
    return response.end(JSON.stringify({ session }));
  }

  if (url.pathname === "/cookies") {
    return json(response, 200, { cookies: collectCookies(request) });
  }

  if (url.pathname === "/html") {
    const html =
      "<!doctype html><html><head><title>Mock HTML</title></head><body><h1>Mock HTML</h1><p>Scripts are blocked by the sandbox.</p><script>document.body.dataset.scriptRan = 'yes';</script></body></html>";
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "content-length": Buffer.byteLength(html),
    });
    return response.end(html);
  }

  if (url.pathname === "/image") {
    response.writeHead(200, {
      "content-type": "image/png",
      "content-length": png.length,
    });
    return response.end(png);
  }

  if (url.pathname === "/big") {
    const size = 6 * 1024 * 1024;
    response.writeHead(200, {
      "content-type": "text/plain; charset=utf-8",
      "content-length": size,
    });
    return response.end("x".repeat(size));
  }

  if (url.pathname === "/big-bin") {
    const size = 6 * 1024 * 1024;
    response.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-length": size,
    });
    return response.end(Buffer.alloc(size, 0x61));
  }

  if (url.pathname === "/slow-headers") {
    await new Promise((resolve) => setTimeout(resolve, 800));
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    response.write("first");
    await new Promise((resolve) => setTimeout(resolve, 800));
    return response.end("-second");
  }

  return json(response, 200, {
    method: request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    headers: request.headers,
    cookies: collectCookies(request),
    body,
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Payload mock server on http://${HOST}:${PORT}`);
});
