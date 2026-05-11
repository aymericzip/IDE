import type { DockviewApi } from 'dockview-react';
import { createContext } from 'react';
import type { TreeContextValue } from './types';

export const EMPTY_SET = new Set<string>();

export const TreeContext = createContext<TreeContextValue>({
  expandDepth: 0,
  indent: 16,
  navRef: { current: null },
  selectedId: null,
  selectedIds: EMPTY_SET,
  setSelectedId: () => undefined,
  setSelectedIds: () => undefined,
});

export const DockviewApiContext = createContext<DockviewApi | null>(null);

export const DepthContext = createContext(0);
