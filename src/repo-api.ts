import { downloadZip } from "client-zip";

import type { TreeDataItem } from "idecn";

export type { TreeDataItem } from "idecn";

export let githubToken: string | null =
  typeof window !== "undefined" ? localStorage.getItem("GH_TOKEN") : null;

export const setGithubToken = (token: string | null) => {
  githubToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("GH_TOKEN", token);
    } else {
      localStorage.removeItem("GH_TOKEN");
    }
  }
};

export type JsdelivrFile = {
  files?: JsdelivrFile[];
  name: string;
  type: "directory" | "file";
};

const IMAGE_EXTS = new Set([
  "apng",
  "avif",
  "bmp",
  "gif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
]);
const MIME: Record<string, string> = {
  apng: "image/apng",
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = "";

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }

  return btoa(binary);
};

const branchCache = new Map<string, string>();

const getDefaultBranch = async (repo: string): Promise<string> => {
  const cached = branchCache.get(repo);
  if (cached) {
    return cached;
  }

  const headers: Record<string, string> = {};
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const response = await fetch(`https://api.github.com/repos/${repo}`, {
    headers,
  });
  if (response.ok) {
    const data = (await response.json()) as { default_branch?: string };
    const branch = data.default_branch ?? "main";
    branchCache.set(repo, branch);
    return branch;
  }

  if (response.status === 404 || response.status === 401) {
    if (!githubToken && typeof window !== "undefined") {
      const token = window.prompt(
        "This repository is private or not found. Please enter a GitHub Personal Access Token (PAT):",
      );
      if (token) {
        setGithubToken(token);
        window.location.reload();
      }
    }
    throw new Error("PRIVATE_REPO_OR_NOT_FOUND");
  }

  return "main";
};

const jsdelivrToTree = (files: JsdelivrFile[], prefix = ""): TreeDataItem[] => {
  const items: TreeDataItem[] = [];
  const sorted = [...files].toSorted((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  for (const file of sorted) {
    const path = prefix ? `${prefix}/${file.name}` : file.name;
    const item: TreeDataItem = { id: path, name: file.name, path };

    if (file.type === "directory" && file.files) {
      item.children = jsdelivrToTree(file.files, path);
    }

    items.push(item);
  }

  return items;
};

const treeFromGitHubFlat = (
  flat: { path: string; type: string }[],
): TreeDataItem[] => {
  const items: TreeDataItem[] = [];
  const directories = new Map<string, TreeDataItem>();

  const sortedFlat = flat.toSorted((a, b) => {
    if (a.type !== b.type) {
      return a.type === "tree" ? -1 : 1;
    }
    return a.path.localeCompare(b.path);
  });

  for (const item of sortedFlat) {
    const parts = item.path.split("/");
    const name = parts.at(-1) ?? item.path;
    const node: TreeDataItem = { id: item.path, name, path: item.path };

    if (item.type === "tree") {
      node.children = [];
      directories.set(item.path, node);
    }

    if (parts.length === 1) {
      items.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      directories.get(parentPath)?.children?.push(node);
    }
  }

  return items;
};

export const fetchTree = async (repo: string): Promise<TreeDataItem[]> => {
  const branch = await getDefaultBranch(repo);
  const headers: Record<string, string> = {};

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
    const githubResponse = await fetch(
      `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`,
      { headers },
    );

    if (githubResponse.ok) {
      const data = (await githubResponse.json()) as {
        tree?: { path: string; type: string }[];
      };

      if (data.tree?.length) {
        return treeFromGitHubFlat(data.tree);
      }
    }
  }

  const jsdelivrResponse = await fetch(
    `https://data.jsdelivr.com/v1/packages/gh/${repo}@${branch}`,
  );

  if (jsdelivrResponse.ok) {
    const data = (await jsdelivrResponse.json()) as { files?: JsdelivrFile[] };

    if (data.files?.length) {
      return jsdelivrToTree(data.files);
    }
  }

  const fallbackGithubResponse = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`,
  );

  if (fallbackGithubResponse.ok) {
    const data = (await fallbackGithubResponse.json()) as {
      tree?: { path: string; type: string }[];
    };

    if (data.tree?.length) {
      return treeFromGitHubFlat(data.tree);
    }
  }

  return [];
};

export const fetchFile = async (
  repo: string,
  path: string,
): Promise<null | string> => {
  const extension = path.split(".").at(-1)?.toLowerCase() ?? "";

  if (githubToken) {
    const branch = await getDefaultBranch(repo).catch(() => "main");
    const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3.raw",
      Authorization: `Bearer ${githubToken}`,
    };

    const response = await fetch(url, { headers });

    if (response.ok) {
      if (IMAGE_EXTS.has(extension)) {
        const buffer = new Uint8Array(await response.arrayBuffer());
        const base64 = uint8ArrayToBase64(buffer);
        const mimeType = MIME[extension] ?? "application/octet-stream";
        return `data:${mimeType};base64,${base64}`;
      }

      return response.text();
    }
    console.error(`Failed to fetch file from GitHub API: ${response.status} ${response.statusText}`, url);
  }

  // JSDelivr automatically resolves the default branch!
  const jsdelivrUrl = `https://cdn.jsdelivr.net/gh/${repo}/${path}`;

  if (IMAGE_EXTS.has(extension)) {
    const response = await fetch(jsdelivrUrl);

    if (!response.ok) {
      return null;
    }

    const buffer = new Uint8Array(await response.arrayBuffer());
    const base64 = uint8ArrayToBase64(buffer);
    const mimeType = MIME[extension] ?? "application/octet-stream";
    return `data:${mimeType};base64,${base64}`;
  }

  const response = await fetch(jsdelivrUrl);
  return response.ok ? response.text() : null;
};

export const downloadFile = async (
  repo: string,
  path: string,
): Promise<null | { base64: string; name: string }> => {
  const branch = await getDefaultBranch(repo).catch(() => "main");
  const headers: Record<string, string> = {};

  let url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
    headers.Accept = "application/vnd.github.v3.raw";
    url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    return null;
  }

  const buffer = new Uint8Array(await response.arrayBuffer());

  return {
    base64: uint8ArrayToBase64(buffer),
    name: path.split("/").at(-1) ?? "file",
  };
};

export const downloadFolder = async (
  repo: string,
  path: string,
): Promise<null | { base64: string; name: string }> => {
  const branch = await getDefaultBranch(repo).catch(() => "main");
  const headers: Record<string, string> = {};

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`,
    { headers },
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    tree?: { path: string; type: string }[];
  };

  if (!data.tree) {
    return null;
  }

  const folderPrefix = path.endsWith("/") ? path : `${path}/`;
  const blobs = data.tree.filter(
    (item) =>
      item.type === "blob" &&
      item.path.startsWith(folderPrefix) &&
      item.path.length > folderPrefix.length,
  );

  if (blobs.length === 0) {
    return null;
  }

  const entries: { input: Uint8Array; name: string }[] = [];

  for (const blob of blobs) {
    let rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${blob.path}`;
    const rawHeaders: Record<string, string> = { ...headers };

    if (githubToken) {
      rawHeaders.Accept = "application/vnd.github.v3.raw";
      rawUrl = `https://api.github.com/repos/${repo}/contents/${blob.path}?ref=${branch}`;
    }

    const rawResponse = await fetch(rawUrl, { headers: rawHeaders });

    if (!rawResponse.ok) {
      continue;
    }

    const buffer = new Uint8Array(await rawResponse.arrayBuffer());
    entries.push({ input: buffer, name: blob.path.slice(folderPrefix.length) });
  }

  if (entries.length === 0) {
    return null;
  }

  const zip = downloadZip(entries);
  const zipBuffer = new Uint8Array(await zip.arrayBuffer());

  return {
    base64: uint8ArrayToBase64(zipBuffer),
    name: path.split("/").filter(Boolean).at(-1) ?? "folder",
  };
};
