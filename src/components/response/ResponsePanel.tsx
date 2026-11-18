import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Copy, Download, Inbox, RefreshCw, Search } from "lucide-react";
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
import { findMatches, type MatchRange } from "../../lib/search";
import { toastError, toastSuccess } from "../../lib/toast";
import { useAppStore } from "../../store/useAppStore";
import { CodeEditor } from "../common/CodeEditor";
import { ResponseSearchBar } from "./ResponseSearchBar";

type HtmlMode = "preview" | "raw";
type JsonMode = "pretty" | "raw";

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
  searchOpen,
  onToggleSearch,
  onCopy,
  onCopyUrl,
  onSave,
}: {
  response: ResponseData;
  searchOpen: boolean;
  onToggleSearch: () => void;
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
      {response.bodyText ? (
        <Tooltip>
          <TooltipTrigger
            className="icon-button"
            aria-label="Search response body"
            aria-pressed={searchOpen}
            onClick={onToggleSearch}
          >
            <Search size={13} aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent data-agent-hidden>Search response body</TooltipContent>
        </Tooltip>
      ) : null}
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

function MatchText({
  text,
  ranges,
  activeIndex,
}: {
  text: string;
  ranges: MatchRange[];
  activeIndex: number;
}) {
  const content = useMemo(() => {
    if (ranges.length === 0) return text;
    const parts: ReactNode[] = [];
    let cursor = 0;
    ranges.forEach((range, index) => {
      if (range.start > cursor) parts.push(text.slice(cursor, range.start));
      parts.push(
        <mark
          key={`${range.start}:${index}`}
          className={
            index === activeIndex
              ? "search-match search-match-active"
              : "search-match"
          }
          data-search-current={index === activeIndex ? "true" : undefined}
        >
          {text.slice(range.start, range.end)}
        </mark>,
      );
      cursor = range.end;
    });
    if (cursor < text.length) parts.push(text.slice(cursor));
    return parts;
  }, [text, ranges, activeIndex]);

  return <>{content}</>;
}

interface BodySearch {
  open: boolean;
  query: string;
  text: string;
  ranges: MatchRange[];
  capped: boolean;
  activeIndex: number;
  unsupported: boolean;
  onQueryChange: (query: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

function BodyView({
  response,
  pretty,
  htmlMode,
  jsonMode,
  onHtmlModeChange,
  onJsonModeChange,
  search,
}: {
  response: ResponseData;
  pretty: string;
  htmlMode: HtmlMode;
  jsonMode: JsonMode;
  onHtmlModeChange: (mode: HtmlMode) => void;
  onJsonModeChange: (mode: JsonMode) => void;
  search: BodySearch;
}) {
  const paneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!search.open || search.activeIndex < 0) return;
    paneRef.current
      ?.querySelector("mark[data-search-current]")
      ?.scrollIntoView({ block: "center" });
  }, [
    search.open,
    search.query,
    search.activeIndex,
    search.text,
    htmlMode,
    jsonMode,
  ]);

  const highlight = (text: string) => (
    <MatchText
      text={text}
      ranges={search.ranges}
      activeIndex={search.activeIndex}
    />
  );

  const searchBar = search.open ? (
    <ResponseSearchBar
      query={search.query}
      matchCount={search.ranges.length}
      activeIndex={search.activeIndex}
      capped={search.capped}
      unsupported={search.unsupported}
      onQueryChange={search.onQueryChange}
      onNext={search.onNext}
      onPrev={search.onPrev}
      onClose={search.onClose}
    />
  ) : null;

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
      <div className="response-body-pane" ref={paneRef}>
        <Tabs
          value={htmlMode}
          onValueChange={(value) => {
            if (value === "preview" || value === "raw") onHtmlModeChange(value);
          }}
          className="section-tabs response-mode-tabs"
          style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
        >
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
                <pre className="code-view">{highlight(response.bodyText)}</pre>
              </div>
            </div>
          </TabsPanel>
        </Tabs>
        {searchBar}
      </div>
    );
  }

  if (isJsonResponse(response)) {
    return (
      <div className="response-body-pane" ref={paneRef}>
        <Tabs
          value={jsonMode}
          onValueChange={(value) => {
            if (value === "pretty" || value === "raw") onJsonModeChange(value);
          }}
          className="section-tabs response-mode-tabs"
          style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
        >
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
                nativeSearch={false}
                search={
                  search.open &&
                  jsonMode === "pretty" &&
                  search.ranges.length > 0
                    ? {
                        ranges: search.ranges,
                        activeIndex: search.activeIndex,
                      }
                    : undefined
                }
              />
            </div>
          </TabsPanel>
          <TabsPanel value="raw" style={{ flex: 1, minHeight: 0 }}>
            <div className="response-scroll" style={{ height: "100%" }}>
              <div className="response-body-view">
                <pre className="code-view">{highlight(response.bodyText)}</pre>
              </div>
            </div>
          </TabsPanel>
        </Tabs>
        {searchBar}
      </div>
    );
  }

  return (
    <div className="response-body-pane" ref={paneRef}>
      <div className="response-scroll">
        <div className="response-body-view">
          <pre className="code-view">{highlight(response.bodyText)}</pre>
        </div>
      </div>
      {searchBar}
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
  const [sectionTab, setSectionTab] = useState("body");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);
  const [htmlMode, setHtmlMode] = useState<HtmlMode>("preview");
  const [jsonMode, setJsonMode] = useState<JsonMode>("pretty");
  const response = tab?.response ?? null;
  const error = tab?.error ?? null;
  const sending = tab?.sending ?? false;

  const pretty = useMemo(
    () =>
      response?.bodyText !== undefined && isJsonResponse(response)
        ? prettyJson(response.bodyText).replace(/\r\n?/g, "\n")
        : "",
    [response],
  );

  const isHtml = (response?.contentType?.toLowerCase() ?? "").includes(
    "text/html",
  );
  const isJson = response ? isJsonResponse(response) : false;
  const searchText = useMemo(() => {
    const body = response?.bodyText;
    if (body === undefined) return "";
    if (isHtml) return body;
    if (isJson && jsonMode === "pretty") return pretty;
    return body;
  }, [response?.bodyText, isHtml, isJson, jsonMode, pretty]);

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setActiveMatch(0);
  }, [response]);

  const matches = useMemo(
    () => findMatches(searchText, searchOpen ? searchQuery : ""),
    [searchText, searchOpen, searchQuery],
  );
  const matchCount = matches.ranges.length;
  const activeIndex = matchCount > 0 ? Math.min(activeMatch, matchCount - 1) : -1;
  const searchUnsupported = isHtml && htmlMode === "preview";

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

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setActiveMatch(0);
  };

  const toggleSearch = () => {
    if (searchOpen && sectionTab === "body") {
      closeSearch();
      return;
    }
    setSectionTab("body");
    setSearchOpen(true);
  };

  const changeSearchQuery = (query: string) => {
    setSearchQuery(query);
    setActiveMatch(0);
  };

  const nextMatch = () => {
    if (matchCount === 0) return;
    setActiveMatch(
      (current) => (Math.min(current, matchCount - 1) + 1) % matchCount,
    );
  };

  const prevMatch = () => {
    if (matchCount === 0) return;
    setActiveMatch(
      (current) =>
        (Math.min(current, matchCount - 1) - 1 + matchCount) % matchCount,
    );
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
        searchOpen={searchOpen}
        onToggleSearch={toggleSearch}
        onCopy={() => void copyBody()}
        onCopyUrl={() => void copyUrl()}
        onSave={() => void saveBody()}
      />
      <Tabs
        value={sectionTab}
        onValueChange={(value) => {
          if (value) setSectionTab(value);
        }}
        className="section-tabs response-tabs"
      >
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
          <BodyView
            response={response}
            pretty={pretty}
            htmlMode={htmlMode}
            jsonMode={jsonMode}
            onHtmlModeChange={setHtmlMode}
            onJsonModeChange={setJsonMode}
            search={{
              open: searchOpen,
              query: searchQuery,
              text: searchText,
              ranges: matches.ranges,
              capped: matches.capped,
              activeIndex,
              unsupported: searchUnsupported,
              onQueryChange: changeSearchQuery,
              onNext: nextMatch,
              onPrev: prevMatch,
              onClose: closeSearch,
            }}
          />
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
