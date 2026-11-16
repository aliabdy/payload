import { useMemo, useState } from "react";
import { Copy, Download, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@ui-sdk/react/button";
import { Input } from "@ui-sdk/react/input";
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@ui-sdk/react/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@ui-sdk/react/tooltip";
import { Waterfall } from "@ui-sdk/react/waterfall";
import type { ResponseData } from "../../types";
import { saveTextAs } from "../../lib/api";
import { copyText } from "../../lib/clipboard";
import {
  errorTitle,
  formatBytes,
  formatMs,
  isJsonResponse,
  prettyJson,
  statusClass,
} from "../../lib/format";
import { toastError, toastSuccess } from "../../lib/toast";
import { useAppStore } from "../../store/useAppStore";
import { CodeEditor } from "../common/CodeEditor";

function responseFileName(response: ResponseData): string {
  const type = response.contentType?.toLowerCase() ?? "";
  if (type.includes("json")) return "response.json";
  if (type.includes("html")) return "response.html";
  if (type.includes("xml")) return "response.xml";
  if (type.includes("css")) return "response.css";
  return "response.txt";
}

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function ResponseMeta({
  response,
  onCopy,
  onCopyUrl,
  onSave,
}: {
  response: ResponseData;
  onCopy: () => void;
  onCopyUrl: () => void;
  onSave: () => void;
}) {
  return (
    <div className="response-head">
      <span className={statusClass(response.status)}>
        {response.status} {response.statusText}
      </span>
      <span className="metric">
        TTFB <strong>{formatMs(response.ttfbMs)}</strong>
      </span>
      <span className="metric">
        Total <strong>{formatMs(response.totalMs)}</strong>
      </span>
      <span className="metric">
        Size <strong>{formatBytes(response.sizeBytes)}</strong>
      </span>
      {response.truncated ? (
        <span className="metric metric-warning">truncated at 5 MB</span>
      ) : null}
      <span className="response-url" title={response.finalUrl}>
        {response.finalUrl}
      </span>
      <Tooltip>
        <TooltipTrigger
          className="icon-button"
          aria-label="Copy final URL"
          onClick={onCopyUrl}
        >
          <Copy size={13} aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent data-agent-hidden>Copy final URL</TooltipContent>
      </Tooltip>
      {response.bodyText !== undefined ? (
        <>
          <Tooltip>
            <TooltipTrigger
              className="icon-button"
              aria-label="Copy response body"
              onClick={onCopy}
            >
              <Copy size={13} aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent data-agent-hidden>Copy response body</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              className="icon-button"
              aria-label="Save response body"
              onClick={onSave}
            >
              <Download size={13} aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent data-agent-hidden>Save response body</TooltipContent>
          </Tooltip>
        </>
      ) : null}
    </div>
  );
}

function BodyView({ response }: { response: ResponseData }) {
  const pretty = useMemo(
    () =>
      response.bodyText !== undefined && isJsonResponse(response)
        ? prettyJson(response.bodyText)
        : "",
    [response],
  );

  if (response.bodyBase64) {
    const type = response.contentType ?? "application/octet-stream";
    if (type.startsWith("image/")) {
      return (
        <div className="response-scroll">
          <img
            className="image-preview"
            src={`data:${type};base64,${response.bodyBase64}`}
            alt="Response preview"
          />
        </div>
      );
    }
    return (
      <div className="response-scroll">
        <p className="inline-empty" style={{ padding: 16 }}>
          Binary response ({formatBytes(response.sizeBytes)}). Copy and save are
          disabled for binary bodies.
        </p>
      </div>
    );
  }

  if (response.bodyText === undefined || response.bodyText === "") {
    return (
      <div className="response-scroll">
        <div className="empty-state">
          <Inbox size={26} />
          The response body is empty.
        </div>
      </div>
    );
  }

  if (response.contentType?.toLowerCase().includes("text/html")) {
    return (
      <Tabs defaultValue="preview" className="section-tabs response-mode-tabs" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <TabsList aria-label="HTML response view">
          <TabsTab value="preview">Preview</TabsTab>
          <TabsTab value="raw">Raw</TabsTab>
        </TabsList>
        <TabsPanel value="preview" style={{ flex: 1, minHeight: 0 }}>
          <iframe
            className="html-preview"
            sandbox=""
            srcDoc={response.bodyText}
            title="HTML response preview"
          />
        </TabsPanel>
        <TabsPanel value="raw" style={{ flex: 1, minHeight: 0 }}>
          <div className="response-scroll" style={{ height: "100%" }}>
            <div className="response-body-view">
              <pre className="code-view">{response.bodyText}</pre>
            </div>
          </div>
        </TabsPanel>
      </Tabs>
    );
  }

  if (isJsonResponse(response)) {
    return (
      <Tabs defaultValue="pretty" className="section-tabs response-mode-tabs" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <TabsList aria-label="JSON response view">
          <TabsTab value="pretty">Pretty</TabsTab>
          <TabsTab value="raw">Raw</TabsTab>
        </TabsList>
        <TabsPanel value="pretty" style={{ flex: 1, minHeight: 0 }}>
          <div className="response-json">
            <CodeEditor
              value={pretty}
              readOnly
              language="json"
              height="100%"
              ariaLabel="Pretty JSON response"
            />
          </div>
        </TabsPanel>
        <TabsPanel value="raw" style={{ flex: 1, minHeight: 0 }}>
          <div className="response-scroll" style={{ height: "100%" }}>
            <div className="response-body-view">
              <pre className="code-view">{response.bodyText}</pre>
            </div>
          </div>
        </TabsPanel>
      </Tabs>
    );
  }

  return (
    <div className="response-scroll">
      <div className="response-body-view">
        <pre className="code-view">{response.bodyText}</pre>
      </div>
    </div>
  );
}

export function ResponsePanel() {
  const tab = useAppStore((state) =>
    state.tabs.find((item) => item.id === state.activeTabId),
  );
  const sendActive = useAppStore((state) => state.sendActive);
  const dismissActiveError = useAppStore((state) => state.dismissActiveError);
  const [headerFilter, setHeaderFilter] = useState("");
  const response = tab?.response ?? null;
  const error = tab?.error ?? null;
  const sending = tab?.sending ?? false;

  const timeline = useMemo(() => {
    if (!response) return [];
    const download = Math.max(1, response.totalMs - response.ttfbMs);
    return [
      {
        value: "ttfb",
        label: `Waiting (TTFB) — ${formatMs(response.ttfbMs)}`,
        start: 0,
        duration: Math.max(1, response.ttfbMs),
      },
      {
        value: "download",
        label: `Download — ${formatMs(download)}`,
        start: response.ttfbMs,
        duration: download,
      },
    ];
  }, [response]);

  const filteredHeaders = useMemo(() => {
    if (!response) return [];
    const query = headerFilter.trim().toLowerCase();
    if (!query) return response.headers;
    return response.headers.filter(
      (header) =>
        header.name.toLowerCase().includes(query) ||
        header.value.toLowerCase().includes(query),
    );
  }, [response, headerFilter]);

  if (!tab) return null;

  const copyBody = async () => {
    if (!response?.bodyText) return;
    const copied = await copyText(response.bodyText);
    if (copied) toastSuccess("Response body copied");
    else toastError("Could not copy to clipboard");
  };

  const copyUrl = async () => {
    if (!response) return;
    const copied = await copyText(response.finalUrl);
    if (copied) toastSuccess("Final URL copied");
    else toastError("Could not copy to clipboard");
  };

  const saveBody = async () => {
    if (!response?.bodyText) return;
    try {
      await saveTextAs(responseFileName(response), response.bodyText);
    } catch (saveError) {
      toastError("Could not save the response body", saveError);
    }
  };

  if (!response && !error) {
    return (
      <section className="pane" aria-label="Response">
        <div className="response-empty">
          <span className="empty-icon">
            {sending ? <span className="spinner" /> : <Inbox size={20} />}
          </span>
          <h2 className="empty-title">
            {sending ? "Waiting for the server…" : "No response yet"}
          </h2>
          <p className="empty-copy">
            {sending
              ? "The request is in flight."
              : "Send a request to see the response here."}
          </p>
          {!sending ? (
            <div className="shortcut-row" aria-hidden="true">
              <span className="kbd">{isMac ? "⌘" : "Ctrl"}</span>
              <span className="kbd">{isMac ? "⏎" : "Enter"}</span>
              <span>send</span>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (error) {
    const cancelled = error.kind === "cancelled";
    return (
      <section className="pane" aria-label="Response">
        <div className="response-head">
          <span
            className={
              cancelled ? "status-pill status-cancelled" : "status-pill status-5xx"
            }
          >
            {cancelled ? "Cancelled" : "Request failed"}
          </span>
          {cancelled ? null : <span className="metric">{error.kind}</span>}
          <span className="grow" />
          <Button className="small-button ghost-button" onClick={() => void sendActive()}>
            <RefreshCw size={12} />
            Retry
          </Button>
          {cancelled ? (
            <Button
              className="small-button ghost-button"
              onClick={dismissActiveError}
            >
              Dismiss
            </Button>
          ) : null}
        </div>
        <div className="response-scroll">
          <div className="error-card">
            <h3>{cancelled ? "Request cancelled." : errorTitle(error)}</h3>
            {cancelled ? null : <p>{error.message}</p>}
          </div>
          {cancelled ? null : (
            <p className="inline-empty" style={{ padding: "0 16px" }}>
              Check the URL, the environment variables, proxy and TLS settings, or
              try again.
            </p>
          )}
        </div>
      </section>
    );
  }

  if (!response) return null;

  return (
    <section className="pane" aria-label="Response">
      <ResponseMeta
        response={response}
        onCopy={() => void copyBody()}
        onCopyUrl={() => void copyUrl()}
        onSave={() => void saveBody()}
      />
      <Tabs defaultValue="body" className="section-tabs response-tabs">
        <TabsList aria-label="Response sections">
          <TabsTab value="body">Body</TabsTab>
          <TabsTab value="headers">
            Headers
            {response.headers.length > 0 ? (
              <span className="count-badge">{response.headers.length}</span>
            ) : null}
          </TabsTab>
          <TabsTab value="timeline">Timeline</TabsTab>
        </TabsList>
        <TabsPanel value="body" className="response-panel">
          <BodyView response={response} />
        </TabsPanel>
        <TabsPanel value="headers" className="response-panel">
          <div className="response-scroll">
            <div style={{ padding: 10 }}>
              <Input
                aria-label="Filter response headers"
                value={headerFilter}
                onValueChange={setHeaderFilter}
                placeholder="Filter headers…"
                spellCheck={false}
              />
            </div>
            {filteredHeaders.length === 0 ? (
              <p className="inline-empty" style={{ padding: "4px 16px 16px" }}>
                No headers match this filter.
              </p>
            ) : (
              <table className="headers-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHeaders.map((header, index) => (
                    <tr key={`${header.name}-${index}`}>
                      <td>{header.name}</td>
                      <td>{header.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsPanel>
        <TabsPanel value="timeline" className="response-panel">
          <div className="response-scroll">
            <div className="timing-wrap">
              <Waterfall items={timeline} aria-label="Response timing" />
              <div className="timing-legend">
                <span className="wait">Waiting (TTFB)</span>
                <span className="download">Download</span>
              </div>
            </div>
          </div>
        </TabsPanel>
      </Tabs>
    </section>
  );
}
