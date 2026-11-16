import { useMemo, type ReactNode } from "react";
import { ChevronRight, Folder, Layers } from "lucide-react";
import { Button } from "@ui-sdk/react/button";
import {
  Tree,
  TreeGroup,
  TreeItem,
  TreeItemIndicator,
  TreeItemLabel,
} from "@ui-sdk/react/tree";
import type { Collection, TreeNode } from "../../types";
import { useAppStore } from "../../store/useAppStore";
import { MethodBadge } from "../common/MethodBadge";

function filteredNode(
  node: TreeNode,
  query: string,
  requests: ReturnType<typeof useAppStore.getState>["data"]["requests"],
): TreeNode | null {
  if (node.type === "request") {
    const request = requests[node.requestId];
    if (!request) return null;
    if (!query) return node;
    return `${request.method} ${request.name} ${request.url}`
      .toLowerCase()
      .includes(query)
      ? node
      : null;
  }
  if (!query) return node;
  const children = node.children
    .map((child) => filteredNode(child, query, requests))
    .filter((child): child is TreeNode => child !== null);
  if (node.name.toLowerCase().includes(query)) return node;
  return children.length > 0 ? { ...node, children } : null;
}

function filteredCollections(
  collections: Collection[],
  query: string,
  requests: ReturnType<typeof useAppStore.getState>["data"]["requests"],
): Collection[] {
  if (!query) return collections;
  return collections.flatMap((collection) => {
    if (collection.name.toLowerCase().includes(query)) return [collection];
    const children = collection.children
      .map((node) => filteredNode(node, query, requests))
      .filter((node): node is TreeNode => node !== null);
    return children.length > 0 ? [{ ...collection, children }] : [];
  });
}

function branchIds(collections: Collection[]): string[] {
  const ids: string[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.type === "folder") {
        ids.push(node.id);
        walk(node.children);
      }
    }
  };
  for (const collection of collections) {
    ids.push(collection.id);
    walk(collection.children);
  }
  return ids;
}

function renderNode(
  node: TreeNode,
  requests: ReturnType<typeof useAppStore.getState>["data"]["requests"],
): ReactNode {
  if (node.type === "folder") {
    return (
      <TreeItem key={node.id} value={node.id} branch>
        <TreeItemLabel>
          <TreeItemIndicator>
            <ChevronRight size={13} />
          </TreeItemIndicator>
          <Folder size={13} />
          <span className="tree-name">{node.name}</span>
        </TreeItemLabel>
        <TreeGroup>
          {node.children.map((child) => renderNode(child, requests))}
        </TreeGroup>
      </TreeItem>
    );
  }
  const request = requests[node.requestId];
  if (!request) return null;
  return (
    <TreeItem key={node.id} value={request.id}>
      <TreeItemLabel>
        <span className="tree-row">
          <MethodBadge method={request.method} />
          {" "}
          <span className="tree-name">{request.name}</span>
        </span>
      </TreeItemLabel>
    </TreeItem>
  );
}

export function CollectionTree({
  onCreateCollection,
  onClearSearch,
}: {
  onCreateCollection?: () => void;
  onClearSearch?: () => void;
}) {
  const collections = useAppStore((state) => state.data.collections);
  const requests = useAppStore((state) => state.data.requests);
  const search = useAppStore((state) => state.search);
  const selectedNode = useAppStore((state) => state.selectedNode);
  const setSelectedNode = useAppStore((state) => state.setSelectedNode);
  const openRequest = useAppStore((state) => state.openRequest);

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () => filteredCollections(collections, query, requests),
    [collections, query, requests],
  );
  const expanded = useMemo(() => branchIds(visible), [visible]);

  if (visible.length === 0) {
    if (collections.length === 0) {
      return (
        <div className="empty-state tree-empty">
          <Layers size={24} aria-hidden="true" />
          <p className="empty-copy">
            No collections yet. Group related requests into a collection to
            keep them organised.
          </p>
          {onCreateCollection ? (
            <Button
              className="small-button primary-button"
              onClick={onCreateCollection}
            >
              New collection
            </Button>
          ) : null}
        </div>
      );
    }
    return (
      <div className="empty-state tree-empty">
        <p className="empty-copy">No requests match “{search.trim()}”.</p>
        {onClearSearch ? (
          <Button className="small-button ghost-button" onClick={onClearSearch}>
            Clear search
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <Tree
      key={query}
      aria-label="Collections"
      className="tree-view"
      mode="single"
      value={selectedNode}
      onValueChange={(value) => {
        if (!value) return;
        setSelectedNode(value);
        if (requests[value]) openRequest(value);
      }}
      onAction={(value) => {
        if (requests[value]) openRequest(value);
      }}
      defaultExpanded={expanded}
    >
      {visible.map((collection) => (
        <TreeItem key={collection.id} value={collection.id} branch>
          <TreeItemLabel>
            <TreeItemIndicator>
              <ChevronRight size={13} />
            </TreeItemIndicator>
            <Layers size={13} />
            <span className="tree-name">{collection.name}</span>
          </TreeItemLabel>
          <TreeGroup>
            {collection.children.map((node) => renderNode(node, requests))}
          </TreeGroup>
        </TreeItem>
      ))}
    </Tree>
  );
}
