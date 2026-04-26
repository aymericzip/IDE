import { downloadZip } from 'client-zip';

import type { TreeDataItem } from 'idecn';

export type { TreeDataItem } from 'idecn';

export interface JsdelivrFile {
  files?: JsdelivrFile[];
  name: string;
  type: 'directory' | 'file';
}

const IMAGE_EXTS = new Set([
  'apng',
  'avif',
  'bmp',
  'gif',
  'ico',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'webp',
]);
const MIME: Record<string, string> = {
  apng: 'image/apng',
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

function u8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1)
    binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

const branchCache = new Map<string, string>();

const getDefaultBranch = async (repo: string): Promise<string> => {
  const cached = branchCache.get(repo);
  if (cached) return cached;
  const r = await fetch(`https://api.github.com/repos/${repo}`);
  if (r.ok) {
    const d = (await r.json()) as { default_branch?: string };
    const branch = d.default_branch ?? 'main';
    branchCache.set(repo, branch);
    return branch;
  }
  return 'main';
};

const jsdelivrToTree = (files: JsdelivrFile[], prefix = ''): TreeDataItem[] => {
  const items: TreeDataItem[] = [];
  const sorted = [...files].toSorted((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const f of sorted) {
    const path = prefix ? `${prefix}/${f.name}` : f.name;
    const item: TreeDataItem = { id: path, name: f.name, path };
    if (f.type === 'directory' && f.files)
      item.children = jsdelivrToTree(f.files, path);
    items.push(item);
  }
  return items;
};

const treeFromGitHubFlat = (
  flat: { path: string; type: string }[]
): TreeDataItem[] => {
  const items: TreeDataItem[] = [];
  const dirs = new Map<string, TreeDataItem>();
  for (const t of flat.toSorted((a, b) => {
    if (a.type !== b.type) return a.type === 'tree' ? -1 : 1;
    return a.path.localeCompare(b.path);
  })) {
    const parts = t.path.split('/');
    const name = parts.at(-1) ?? t.path;
    const node: TreeDataItem = { id: t.path, name, path: t.path };
    if (t.type === 'tree') {
      node.children = [];
      dirs.set(t.path, node);
    }
    if (parts.length === 1) items.push(node);
    else dirs.get(parts.slice(0, -1).join('/'))?.children?.push(node);
  }
  return items;
};

export const fetchTree = async (repo: string): Promise<TreeDataItem[]> => {
  const branch = await getDefaultBranch(repo);
  const r = await fetch(
    `https://data.jsdelivr.com/v1/packages/gh/${repo}@${branch}`
  );
  if (r.ok) {
    const d = (await r.json()) as { files?: JsdelivrFile[] };
    if (d.files && d.files.length) return jsdelivrToTree(d.files);
  }
  const gh = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`
  );
  if (gh.ok) {
    const d = (await gh.json()) as { tree?: { path: string; type: string }[] };
    if (d.tree?.length) return treeFromGitHubFlat(d.tree);
  }
  return [];
};

export const fetchFile = async (
  repo: string,
  path: string
): Promise<null | string> => {
  const branch = await getDefaultBranch(repo);
  const ext = path.split('.').at(-1)?.toLowerCase() ?? '';
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
  if (IMAGE_EXTS.has(ext)) {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return `data:${MIME[ext] ?? 'application/octet-stream'};base64,${u8ToBase64(buf)}`;
  }
  const res = await fetch(url);
  return res.ok ? res.text() : null;
};

export const downloadFile = async (
  repo: string,
  path: string
): Promise<null | { base64: string; name: string }> => {
  const branch = await getDefaultBranch(repo);
  const res = await fetch(
    `https://raw.githubusercontent.com/${repo}/${branch}/${path}`
  );
  if (!res.ok) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  return {
    base64: u8ToBase64(buf),
    name: path.split('/').at(-1) ?? 'file',
  };
};

export const downloadFolder = async (
  repo: string,
  path: string
): Promise<null | { base64: string; name: string }> => {
  const branch = await getDefaultBranch(repo);
  const r = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`
  );
  if (!r.ok) return null;
  const d = (await r.json()) as { tree?: { path: string; type: string }[] };
  if (!d.tree) return null;
  const pre = path.endsWith('/') ? path : `${path}/`;
  const blobs = d.tree.filter(
    (t) =>
      t.type === 'blob' &&
      t.path.startsWith(pre) &&
      t.path.length > pre.length
  );
  if (blobs.length === 0) return null;
  const entries: { input: Uint8Array; name: string }[] = [];
  for (const t of blobs) {
    const raw = await fetch(
      `https://raw.githubusercontent.com/${repo}/${branch}/${t.path}`
    );
    if (!raw.ok) continue;
    const buf = new Uint8Array(await raw.arrayBuffer());
    entries.push({ input: buf, name: t.path.slice(pre.length) });
  }
  if (entries.length === 0) return null;
  const z = await downloadZip(entries);
  return {
    base64: u8ToBase64(new Uint8Array(await z.arrayBuffer())),
    name: path.split('/').filter(Boolean).at(-1) ?? 'folder',
  };
};
