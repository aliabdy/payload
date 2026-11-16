import { useMemo } from "react";
import { Listbox, ListboxItem } from "@ui-sdk/react/listbox";
import {
  formatMs,
  formatTimestamp,
  statusClass,
} from "../../lib/format";
import { useAppStore } from "../../store/useAppStore";
import { MethodBadge } from "../common/MethodBadge";

function splitUrl(raw: string): { path: string; host: string } {
  try {
    const url = new URL(raw);
    const path = `${url.pathname}${url.search}${url.hash}`;
    return { path: path || "/", host: url.host };
  } catch {
    return { path: raw, host: "" };
  }
}

function formatHistoryTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear()
      ? {}
      : { year: "numeric" }),
  });
}

export function HistoryList({ filter = "" }: { filter?: string }) {
  const history = useAppStore((state) => state.data.history);
  const openFromHistory = useAppStore((state) => state.openFromHistory);
  const query = filter.trim().toLowerCase();

  const entries = useMemo(() => {
    if (!query) return history;
    return history.filter(
      (entry) =>
        entry.method.toLowerCase().includes(query) ||
        entry.url.toLowerCase().includes(query) ||
        (entry.status !== null
          ? String(entry.status).includes(query)
          : "failed".includes(query)),
    );
  }, [history, query]);

  if (history.length === 0) {
    return (
      <p className="inline-empty">
        Requests you send appear here, newest first.
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="inline-empty">
        No requests match “{filter.trim()}”.
      </p>
    );
  }

  return (
    <Listbox
      aria-label="Request history"
      className="history-list"
      onValueChange={(value) => {
        if (value) openFromHistory(value);
      }}
    >
      {entries.map((entry) => {
        const { path, host } = splitUrl(entry.url);
        const time = formatHistoryTime(entry.at);
        const exactTime = formatTimestamp(entry.at);
        const statusLabel = entry.status !== null ? String(entry.status) : "failed";
        return (
          <ListboxItem
            key={entry.id}
            value={entry.id}
            label={`${entry.method} ${path}${host ? ` on ${host}` : ""}, ${statusLabel}, ${exactTime || time}`}
          >
            <div className="history-row">
              <MethodBadge method={entry.method} />
              <span className="history-path" title={entry.url}>
                {path}
              </span>
              {entry.status !== null ? (
                <span className={`${statusClass(entry.status)} history-status`}>
                  {entry.status}
                </span>
              ) : (
                <span className="status-pill status-failed history-status">
                  Failed
                </span>
              )}
            </div>
            <div className="history-meta">
              {host ? (
                <span className="history-host" title={entry.url}>
                  {host}
                </span>
              ) : (
                <span className="history-host" />
              )}
              <span className="history-stats" title={exactTime}>
                {entry.timeMs !== null ? (
                  <span>{formatMs(entry.timeMs)}</span>
                ) : null}
                {time ? <span>{time}</span> : null}
              </span>
            </div>
          </ListboxItem>
        );
      })}
    </Listbox>
  );
}
