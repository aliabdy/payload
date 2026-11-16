import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Button } from "@ui-sdk/react/button";
import {
  createMenuController,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@ui-sdk/react/menu";
import {
  Tabs,
  TabsList,
  TabsTab,
} from "@ui-sdk/react/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@ui-sdk/react/tooltip";
import { useAppStore } from "../../store/useAppStore";
import { tabDisplayNames } from "../../lib/tabs";
import { MethodBadge } from "../common/MethodBadge";

interface TabMenuPayload {
  tabId: string;
}

export function RequestTabStrip() {
  const tabs = useAppStore((state) => state.tabs);
  const activeTabId = useAppStore((state) => state.activeTabId);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const requestCloseTab = useAppStore((state) => state.requestCloseTab);
  const focusTabToken = useAppStore((state) => state.focusTabToken);
  const createScratchTab = useAppStore((state) => state.createScratchTab);
  const renameTab = useAppStore((state) => state.renameTab);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handledFocusTokenRef = useRef(0);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const cancelRenameRef = useRef(false);
  const pendingRenameRef = useRef<string | null>(null);
  const [renaming, setRenaming] = useState<{ tabId: string; draft: string } | null>(
    null,
  );
  const [menuTabId, setMenuTabId] = useState<string | null>(null);
  const [menu] = useState(() => createMenuController<TabMenuPayload>());
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const tabNames = useMemo(() => tabDisplayNames(tabs), [tabs]);
  const menuTab = menuTabId
    ? tabs.find((tab) => tab.id === menuTabId) ?? null
    : null;

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setOverflow((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right },
    );
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measure();
    const onScroll = () => measure();
    el.addEventListener("scroll", onScroll, { passive: true });
    if (typeof ResizeObserver === "undefined") {
      return () => el.removeEventListener("scroll", onScroll);
    }
    const observer = new ResizeObserver(onScroll);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [measure, tabs.length]);

  useEffect(() => {
    const el = scrollRef.current;
    const active = el?.querySelector<HTMLElement>(
      '[data-slot="tabs-tab"][data-selected]',
    );
    if (!el || !active) return;
    const view = el.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    const pad = 12;
    if (rect.left < view.left + pad) {
      el.scrollLeft -= view.left + pad - rect.left;
    } else if (rect.right > view.right - pad) {
      el.scrollLeft += rect.right - (view.right - pad);
    }
  }, [activeTabId, tabs.length]);

  useEffect(() => {
    if (focusTabToken === handledFocusTokenRef.current) return;
    handledFocusTokenRef.current = focusTabToken;
    scrollRef.current
      ?.querySelector<HTMLElement>('[data-slot="tabs-tab"][data-selected]')
      ?.focus();
  }, [focusTabToken, activeTabId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      if (event.deltaY === 0) return;
      event.preventDefault();
      el.scrollLeft += event.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let pointerId: number | null = null;
    let startX = 0;
    let startScrollLeft = 0;
    let panning = false;

    const suppressClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const stopPan = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      const wasPanning = panning;
      pointerId = null;
      panning = false;
      el.classList.remove("is-panning");
      if (el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
      if (wasPanning) {
        el.addEventListener("click", suppressClick, { capture: true });
        window.setTimeout(
          () => el.removeEventListener("click", suppressClick, { capture: true }),
          0,
        );
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      if ((event.target as HTMLElement).closest("input, textarea, [contenteditable]")) {
        return;
      }
      if (el.scrollWidth <= el.clientWidth) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScrollLeft = el.scrollLeft;
      panning = false;
      el.classList.add("is-panning");
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      const dx = event.clientX - startX;
      if (!panning) {
        if (Math.abs(dx) < 4) return;
        panning = true;
        el.setPointerCapture(event.pointerId);
      }
      el.scrollLeft = startScrollLeft - dx;
      event.preventDefault();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", stopPan);
    el.addEventListener("pointercancel", stopPan);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", stopPan);
      el.removeEventListener("pointercancel", stopPan);
    };
  }, []);

  useEffect(() => {
    if (!renaming) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renaming?.tabId]);

  const beginRename = useCallback(
    (tabId: string) => {
      const tab = useAppStore.getState().tabs.find((item) => item.id === tabId);
      if (!tab) return;
      cancelRenameRef.current = false;
      setActiveTab(tab.id);
      setRenaming({ tabId: tab.id, draft: tab.name });
    },
    [setActiveTab],
  );

  const commitRename = () => {
    if (!renaming) return;
    const { tabId, draft } = renaming;
    setRenaming(null);
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false;
      return;
    }
    if (draft.trim()) renameTab(tabId, draft);
  };

  const saveTab = (tabId: string) => {
    const state = useAppStore.getState();
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab || tab.savedRequestId) return;
    state.setActiveTab(tabId);
    state.openSaveDialog();
  };

  const hasOverflow = overflow.left || overflow.right;
  const scrollClass = [
    "tabstrip-tabs",
    overflow.left ? "has-overflow-left" : "",
    overflow.right ? "has-overflow-right" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="tabstrip">
      <Tabs
        ref={scrollRef}
        value={activeTabId}
        onValueChange={(value) => {
          if (value) setActiveTab(value);
        }}
        className={scrollClass}
      >
        <TabsList aria-label="Open requests">
          {tabs.map((tab) =>
            renaming?.tabId === tab.id ? (
              <div key={tab.id} className="tab-rename-item">
                <MethodBadge method={tab.request.method} />
                <input
                  ref={renameInputRef}
                  className="tab-rename-input"
                  aria-label={`Rename ${tabNames.get(tab.id) ?? tab.name}`}
                  value={renaming.draft}
                  spellCheck={false}
                  autoFocus
                  style={{
                    width: Math.min(
                      180,
                      Math.max(72, renaming.draft.length * 7 + 24),
                    ),
                  }}
                  onChange={(event) =>
                    setRenaming({ tabId: tab.id, draft: event.target.value })
                  }
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitRename();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      cancelRenameRef.current = true;
                      setRenaming(null);
                    }
                  }}
                  onBlur={commitRename}
                  onContextMenu={(event) => event.stopPropagation()}
                />
                {tab.dirty ? (
                  <span className="tab-dirty" aria-hidden="true" />
                ) : null}
              </div>
            ) : (
              <div className="tabstrip-item" role="presentation" key={tab.id}>
                <TabsTab
                  value={tab.id}
                  title={tabNames.get(tab.id) ?? tab.name}
                  aria-label={`${tabNames.get(tab.id) ?? tab.name}${tab.dirty ? ", unsaved changes" : ""}`}
                  onDoubleClick={() => beginRename(tab.id)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenuTabId(tab.id);
                    void menu.open({
                      payload: { tabId: tab.id },
                      anchor: { x: event.clientX, y: event.clientY },
                    });
                  }}
                  onAuxClick={(event) => {
                    if (event.button === 1) {
                      event.preventDefault();
                      requestCloseTab(tab.id);
                    }
                  }}
                >
                  <MethodBadge method={tab.request.method} />
                  {" "}
                  <span className="tab-name">
                    {tabNames.get(tab.id) ?? tab.name}
                  </span>
                  {tab.dirty ? (
                    <span className="tab-dirty" aria-hidden="true" title="Unsaved draft" />
                  ) : null}
                </TabsTab>
                <Tooltip>
                  <TooltipTrigger
                    className="tab-close"
                    aria-label={`Close ${tabNames.get(tab.id) ?? tab.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      requestCloseTab(tab.id);
                    }}
                  >
                    <X size={12} aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent data-agent-hidden>
                    Close {tabNames.get(tab.id) ?? tab.name}
                  </TooltipContent>
                </Tooltip>
              </div>
            ),
          )}
        </TabsList>
      </Tabs>
      <Menu
        controller={menu}
        onOpenChangeComplete={(open) => {
          if (open) return;
          const pending = pendingRenameRef.current;
          pendingRenameRef.current = null;
          if (pending) beginRename(pending);
        }}
        onAction={(value) => {
          const tabId = menu.getPayload()?.tabId;
          if (!tabId) return;
          if (value === "save") saveTab(tabId);
          else if (value === "rename") pendingRenameRef.current = tabId;
          else if (value === "close") requestCloseTab(tabId);
        }}
      >
        <MenuContent className="popup-content tab-context-menu" sideOffset={4}>
          {menuTab && !menuTab.savedRequestId ? (
            <MenuItem value="save">Save request…</MenuItem>
          ) : null}
          <MenuItem value="rename">Rename tab</MenuItem>
          <MenuSeparator />
          <MenuItem value="close">Close tab</MenuItem>
        </MenuContent>
      </Menu>
      <div className="tabstrip-actions">
        {hasOverflow ? (
          <Menu onAction={(value) => setActiveTab(value)}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <MenuTrigger
                    className="icon-button"
                    aria-label={`All open tabs (${tabs.length})`}
                  />
                }
              >
                <ChevronDown size={14} aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent data-agent-hidden>All open tabs</TooltipContent>
            </Tooltip>
            <MenuContent className="popup-content tabstrip-overflow-menu">
              {tabs.map((tab) => (
                <MenuItem
                  key={tab.id}
                  value={tab.id}
                  className="tab-overflow-item"
                  data-active={tab.id === activeTabId ? "" : undefined}
                  title={tabNames.get(tab.id) ?? tab.name}
                >
                  <MethodBadge method={tab.request.method} />
                  <span className="tab-overflow-name">
                    {tabNames.get(tab.id) ?? tab.name}
                  </span>
                  {tab.dirty ? (
                    <span className="tab-dirty" aria-hidden="true" />
                  ) : null}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        ) : null}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="icon-button"
                aria-label="New request tab"
                onClick={() => createScratchTab()}
              />
            }
          >
            <Plus size={14} aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent data-agent-hidden>New request tab</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
