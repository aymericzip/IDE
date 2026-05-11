import type { ComponentType, ReactNode } from 'react';

export type IconManifest = {
  file: string;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  folder: string;
  folderExpanded: string;
  folderNames: Record<string, string>;
  folderNamesExpanded: Record<string, string>;
  languageIds: Record<string, string>;
};

export type PanelPosition = {
  direction: 'above' | 'below' | 'left' | 'right' | 'within';
  referenceGroup: string;
};

export type VirtualFile = {
  content: string;
  icon?: ComponentType<{ className?: string }>;
  language?: string;
  name: string;
  open?: boolean;
  pin?: 'bottom' | 'top';
};

export type FileActions = {
  onDownload?: (path: string) => Promise<void> | void;
};

export type TreeDataItem = {
  actions?: ReactNode;
  children?: TreeDataItem[];
  className?: string;
  disabled?: boolean;
  icon?: ComponentType<{ className?: string }> | string;
  id: string;
  name: string;
  onClick?: () => void;
  path: string;
};

export type WorkspaceRef = {
  focusPanel: (id: string) => void;
  openFile: (item: TreeDataItem) => void;
  toggleSidebar: () => void;
};

export type TabProps = {
  activeClassName?: string;
  children: ReactNode;
  closable?: boolean;
  headerClassName?: string;
  icon?: boolean;
  id?: string;
  inactiveClassName?: string;
  onClose?: () => void;
  title: string;
};

export type TreeContextValue = {
  expandDepth: number;
  expandExclude?: string[];
  fileActions?: FileActions;
  indent: number;
  log?: (msg: string) => void;
  navRef: React.RefObject<HTMLElement | null>;
  onSelect?: (item: { id: string; name: string; path: string }) => void;
  selectedId: null | string;
  selectedIds: Set<string>;
  setSelectedId: (id: string) => void;
  setSelectedIds: (ids: Set<string>) => void;
};
