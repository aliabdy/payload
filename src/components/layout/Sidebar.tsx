import { useState } from "react";
import {
  FolderPlus,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@ui-sdk/react/tabs";
import {
  Toolbar,
  ToolbarButton,
} from "@ui-sdk/react/toolbar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@ui-sdk/react/tooltip";
import { environmentLabel } from "../../lib/variables";
import {
  countRequests,
  findRequestNode,
  findTarget,
} from "../../lib/tree";
import { useAppStore } from "../../store/useAppStore";
import { CollectionTree } from "../collections/CollectionTree";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { NameDialog } from "../dialogs/NameDialog";
import { HistoryList } from "../history/HistoryList";

export function Sidebar() {
  const collections = useAppStore((state) => state.data.collections);
  const requests = useAppStore((state) => state.data.requests);
  const environments = useAppStore((state) => state.data.environments);
  const activeEnvId = useAppStore((state) => state.data.activeEnvId);
  const selectedNode = useAppStore((state) => state.selectedNode);
  const search = useAppStore((state) => state.search);
  const setSearch = useAppStore((state) => state.setSearch);
  const createScratchTab = useAppStore((state) => state.createScratchTab);
  const createCollection = useAppStore((state) => state.createCollection);
  const createFolder = useAppStore((state) => state.createFolder);
  const renameNode = useAppStore((state) => state.renameNode);
  const deleteNode = useAppStore((state) => state.deleteNode);
  const clearHistory = useAppStore((state) => state.clearHistory);
  const historyCount = useAppStore((state) => state.data.history.length);

  const [folderDialog, setFolderDialog] = useState(false);
  const [collectionDialog, setCollectionDialog] = useState(false);
  const [renameDialog, setRenameDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  const selectedRequest = selectedNode ? requests[selectedNode] : undefined;
  const selectedTarget = selectedNode ? findTarget(collections, selectedNode) : null;
  const selectedName = selectedRequest?.name ?? selectedTarget?.name ?? "";
  const selectedCollection =
    selectedTarget && "children" in selectedTarget && !("type" in selectedTarget)
      ? (selectedTarget as { id: string; name: string })
      : collections.find((collection) => collection.id === selectedNode) ?? null;

  const folderTargetId = (() => {
    if (selectedTarget) return selectedTarget.id;
    if (selectedRequest) {
      return findRequestNode(collections, selectedRequest.id)?.parent.id ?? null;
    }
    return collections[0]?.id ?? null;
  })();

  const canModify = !!(selectedRequest || selectedTarget);
  const deleteDescription = selectedRequest
    ? "This removes the request from its collection and closes any open tab for it."
    : selectedCollection
      ? "This deletes the collection and every folder and request inside it."
      : "This deletes the folder and every request inside it.";

  return (
    <aside className="sidebar" aria-label="Workspace sidebar">
      <Tabs defaultValue="collections" className="sidebar-tabs">
        <TabsList aria-label="Sidebar view">
          <TabsTab value="collections">Collections</TabsTab>
          <TabsTab value="history">
            History
            {historyCount > 0 ? (
              <span className="count-badge">{historyCount}</span>
            ) : null}
          </TabsTab>
        </TabsList>

        <TabsPanel value="collections" className="sidebar-panel">
          <div className="sidebar-head">
            <Field className="search-field">
              <FieldLabel>Search collections</FieldLabel>
              <div className="search-box">
                <Search className="search-icon" size={13} aria-hidden="true" />
                <Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Filter requests…"
                  spellCheck={false}
                />
              </div>
            </Field>
          </div>
          <Toolbar aria-label="Collection actions" className="sidebar-actions">
            <Tooltip>
              <TooltipTrigger
                render={
                  <ToolbarButton
                    className="icon-button"
                    aria-label="New request"
                    onClick={() => createScratchTab()}
                  />
                }
              >
                <Plus size={15} aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent data-agent-hidden>New request</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <ToolbarButton
                    className="icon-button"
                    aria-label="New folder"
                    disabled={!folderTargetId}
                    onClick={() => setFolderDialog(true)}
                  />
                }
              >
                <FolderPlus size={15} aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent data-agent-hidden>New folder</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <ToolbarButton
                    className="icon-button"
                    aria-label="New collection"
                    onClick={() => setCollectionDialog(true)}
                  />
                }
              >
                <Layers size={15} aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent data-agent-hidden>New collection</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <ToolbarButton
                    className="icon-button"
                    aria-label="Rename selected item"
                    disabled={!canModify}
                    onClick={() => setRenameDialog(true)}
                  />
                }
              >
                <Pencil size={14} aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent data-agent-hidden>Rename selected item</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <ToolbarButton
                    className="icon-button"
                    aria-label="Delete selected item"
                    disabled={!canModify}
                    onClick={() => setDeleteConfirm(true)}
                  />
                }
              >
                <Trash2 size={14} aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent data-agent-hidden>Delete selected item</TooltipContent>
            </Tooltip>
          </Toolbar>
          <div className="sidebar-scroll">
            <CollectionTree
              onCreateCollection={() => setCollectionDialog(true)}
              onClearSearch={() => setSearch("")}
            />
          </div>
        </TabsPanel>

        <TabsPanel value="history" className="sidebar-panel">
          {historyCount > 0 ? (
            <div className="sidebar-head">
              <Field className="search-field history-search">
                <FieldLabel>Search history</FieldLabel>
                <div className="search-box">
                  <Search className="search-icon" size={13} aria-hidden="true" />
                  <Input
                    value={historySearch}
                    onValueChange={setHistorySearch}
                    placeholder="Filter history…"
                    spellCheck={false}
                  />
                </div>
              </Field>
            </div>
          ) : null}
          <div className="sidebar-scroll">
            <HistoryList filter={historySearch} />
          </div>
          {historyCount > 0 ? (
            <div className="history-foot">
              <Button
                className="small-button ghost-button history-clear"
                onClick={() => setClearConfirm(true)}
              >
                <Trash2 size={12} aria-hidden="true" />
                Clear history
              </Button>
            </div>
          ) : null}
        </TabsPanel>
      </Tabs>

      <div className="sidebar-foot">
        <span className="status-dot" aria-hidden="true" />
        <span>{countRequests(collections)} requests</span>
        <span className="foot-sep" aria-hidden="true">
          ·
        </span>
        <span className="foot-env">
          {environmentLabel(environments, activeEnvId)}
        </span>
      </div>

      <NameDialog
        open={collectionDialog}
        onOpenChange={setCollectionDialog}
        title="New collection"
        description="Group related requests together."
        label="Collection name"
        initialValue="New collection"
        submitLabel="Create collection"
        onSubmit={(name) => createCollection(name)}
      />
      <NameDialog
        open={folderDialog}
        onOpenChange={setFolderDialog}
        title="New folder"
        description="Folders nest inside a collection or another folder."
        label="Folder name"
        initialValue="New folder"
        submitLabel="Create folder"
        onSubmit={(name) => {
          if (folderTargetId) createFolder(folderTargetId, name);
        }}
      />
      <NameDialog
        open={renameDialog}
        onOpenChange={setRenameDialog}
        title="Rename item"
        description="The new name appears in the sidebar and on its tab."
        label="Name"
        initialValue={selectedName}
        submitLabel="Rename"
        onSubmit={(name) => {
          if (selectedNode) renameNode(selectedNode, name);
        }}
      />
      <ConfirmDialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        title="Delete this item?"
        description={deleteDescription}
        confirmLabel="Delete"
        agentConfirm={
          selectedCollection
            ? "Deletes this collection and its requests"
            : selectedRequest
              ? "Deletes this saved request and closes its tabs"
              : "Deletes this folder and its requests"
        }
        onConfirm={() => {
          if (selectedNode) deleteNode(selectedNode);
        }}
      />
      <ConfirmDialog
        open={clearConfirm}
        onOpenChange={setClearConfirm}
        title="Clear request history?"
        description="Every entry is removed. Saved requests and collections stay."
        confirmLabel="Clear history"
        agentConfirm="Clears all request history"
        onConfirm={clearHistory}
      />
    </aside>
  );
}
