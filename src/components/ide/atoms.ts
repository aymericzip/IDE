import { atom, type PrimitiveAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { TreeDataItem } from "./types";

export const cursorAtom = atom({ col: 1, line: 1 });
export const activeFileInfoAtom = atom({ language: "plaintext", path: "" });
export const closedTabsAtom = atom<string[]>([]);
export const pinnedTabsAtom = atom<string[]>([]);
export const fontSizeAtom = atomWithStorage("idecn:fontSizeDelta", 0);
export const wordWrapAtom = atomWithStorage("idecn:wordWrap", false);
export const previewPanelAtom = atom<null | string>(null) as PrimitiveAtom<null | string>;
export const quickOpenAtom = atom(false);
export const treeAtom = atom<TreeDataItem[]>([]);
export const openFileAtom = atom<((item: TreeDataItem) => void) | null>(
  null,
) as PrimitiveAtom<((item: TreeDataItem) => void) | null>;
