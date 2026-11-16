import type {
  Collection,
  FolderNode,
  RequestNode,
  TreeNode,
} from "../types";

export function findRequestNode(
  collections: Collection[],
  requestId: string,
): { node: RequestNode; parent: Collection | FolderNode } | null {
  const walk = (
    children: TreeNode[],
    parent: Collection | FolderNode,
  ): { node: RequestNode; parent: Collection | FolderNode } | null => {
    for (const node of children) {
      if (node.type === "request" && node.requestId === requestId) {
        return { node, parent };
      }
      if (node.type === "folder") {
        const found = walk(node.children, node);
        if (found) return found;
      }
    }
    return null;
  };
  for (const collection of collections) {
    const found = walk(collection.children, collection);
    if (found) return found;
  }
  return null;
}

export function collectRequestIds(node: TreeNode | Collection): string[] {
  if ("type" in node && node.type === "request") return [node.requestId];
  const children = node.children;
  return children.flatMap((child) => collectRequestIds(child));
}

export function removeNode(
  collections: Collection[],
  nodeId: string,
): { collections: Collection[]; requestIds: string[]; removed: boolean } {
  let requestIds: string[] = [];
  let removed = false;

  const walk = (children: TreeNode[]): TreeNode[] =>
    children.flatMap((node): TreeNode[] => {
      if (node.id === nodeId) {
        removed = true;
        requestIds = collectRequestIds(node);
        return [];
      }
      if (node.type === "folder") {
        return [{ ...node, children: walk(node.children) }];
      }
      return [node];
    });

  const next = collections.flatMap((collection) => {
    if (collection.id === nodeId) {
      removed = true;
      requestIds = collectRequestIds(collection);
      return [];
    }
    return [{ ...collection, children: walk(collection.children) }];
  });

  return { collections: next, requestIds, removed };
}

export function findTarget(
  collections: Collection[],
  id: string,
): Collection | FolderNode | null {
  for (const collection of collections) {
    if (collection.id === id) return collection;
    const walk = (nodes: TreeNode[]): FolderNode | null => {
      for (const node of nodes) {
        if (node.type !== "folder") continue;
        if (node.id === id) return node;
        const found = walk(node.children);
        if (found) return found;
      }
      return null;
    };
    const found = walk(collection.children);
    if (found) return found;
  }
  return null;
}

export function findParent(
  collections: Collection[],
  nodeId: string,
): { children: TreeNode[]; parent: Collection | FolderNode } | null {
  const walk = (
    children: TreeNode[],
    parent: Collection | FolderNode,
  ): { children: TreeNode[]; parent: Collection | FolderNode } | null => {
    if (children.some((node) => node.id === nodeId)) return { children, parent };
    for (const node of children) {
      if (node.type !== "folder") continue;
      const found = walk(node.children, node);
      if (found) return found;
    }
    return null;
  };
  for (const collection of collections) {
    if (collection.id === nodeId) {
      return { children: collection.children, parent: collection };
    }
    const found = walk(collection.children, collection);
    if (found) return found;
  }
  return null;
}

export function renameNode(
  collections: Collection[],
  nodeId: string,
  name: string,
): Collection[] {
  const walk = (children: TreeNode[]): TreeNode[] =>
    children.map((node) => {
      if (node.type === "folder") {
        return {
          ...node,
          name: node.id === nodeId ? name : node.name,
          children:
            node.id === nodeId ? node.children : walk(node.children),
        };
      }
      return node;
    });
  return collections.map((collection) =>
    collection.id === nodeId
      ? { ...collection, name }
      : { ...collection, children: walk(collection.children) },
  );
}

export function flattenCollections(
  collections: Collection[],
): { value: string; label: string; depth: number }[] {
  const rows: { value: string; label: string; depth: number }[] = [];
  const walkNodes = (nodes: TreeNode[], depth: number) => {
    for (const node of nodes) {
      if (node.type !== "folder") continue;
      rows.push({ value: node.id, label: node.name, depth });
      walkNodes(node.children, depth + 1);
    }
  };
  for (const collection of collections) {
    rows.push({ value: collection.id, label: collection.name, depth: 0 });
    walkNodes(collection.children, 1);
  }
  return rows;
}

export function countRequests(collections: Collection[]): number {
  return collections.reduce(
    (total, collection) => total + collectRequestIds(collection).length,
    0,
  );
}
