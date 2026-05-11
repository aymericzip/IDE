import {
  type ComponentProps,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '../../lib/utils';
import { EMPTY_SET, TreeContext } from '../IDEContext';
import { compactFolder } from '../utils';

import { TreeFile } from './TreeFile';
import { TreeFolder } from './TreeFolder';

export { TreeFile, TreeFolder };

import type { FileActions, TreeDataItem } from '../types';

const renderItems = ({
  items,
  onItemClick,
  onItemDoubleClick,
}: {
  items: TreeDataItem[];
  onItemClick?: (item: TreeDataItem) => void;
  onItemDoubleClick?: (item: TreeDataItem) => void;
}): ReactNode[] => {
  const nodes: ReactNode[] = [];

  for (const item of items) {
    if (item.children) {
      const { children, name } = compactFolder(item);
      nodes.push(
        <TreeFolder
          disabled={item.disabled}
          id={item.id}
          key={item.id}
          name={name}
          path={item.path}
        >
          {renderItems({ items: children, onItemClick, onItemDoubleClick })}
        </TreeFolder>,
      );
    } else {
      nodes.push(
        <TreeFile
          disabled={item.disabled}
          icon={item.icon}
          id={item.id}
          key={item.id}
          name={item.name}
          onClick={() => {
            item.onClick?.();
            onItemClick?.(item);
          }}
          onDoubleClick={() => onItemDoubleClick?.(item)}
          path={item.path}
        />,
      );
    }
  }

  return nodes;
};

export const Tree = ({
  children,
  expandDepth = 0,
  expandExclude,
  fileActions,
  indent = 16,
  log,
  onSelect,
  selectedId: controlledSelectedId,
  ...props
}: ComponentProps<"nav"> & {
  expandDepth?: number;
  expandExclude?: string[];
  fileActions?: FileActions;
  indent?: number;
  log?: (msg: string) => void;
  onSelect?: (item: { id: string; name: string; path: string }) => void;
  selectedId?: null | string;
}) => {
  const [internalSelectedId, setInternalSelectedId] = useState<null | string>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(EMPTY_SET);
  const navRef = useRef<HTMLElement>(null);
  const selectedId = controlledSelectedId ?? internalSelectedId;

  const contextValue = useMemo(
    () => ({
      expandDepth,
      expandExclude,
      fileActions,
      indent,
      log,
      navRef,
      onSelect,
      selectedId,
      selectedIds,
      setSelectedId: setInternalSelectedId,
      setSelectedIds,
    }),
    [
      expandDepth,
      expandExclude,
      fileActions,
      indent,
      log,
      onSelect,
      selectedId,
      selectedIds,
    ],
  );

  return (
    <TreeContext value={contextValue}>
      <nav
        aria-label="File tree"
        ref={navRef}
        {...props}
        className={cn(
          'select-none overflow-auto text-xs [scrollbar-color:color-mix(in_oklch,var(--color-foreground,var(--foreground))_15%,transparent)_transparent] [scrollbar-width:thin]',
          props.className
        )}
        onKeyDownCapture={(event) => {
          if (![" ", "ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
            return;
          }

          const target = event.target as HTMLElement;

          if (!target.closest("[role=treeitem]")) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();

          const items =
            event.currentTarget.querySelectorAll<HTMLElement>("[role=treeitem]");
          const treeItem = target.closest("[role=treeitem]");
          const index = treeItem
            ? [...items].indexOf(treeItem as HTMLElement)
            : -1;

          if (event.key === "ArrowDown") {
            items[Math.min(index + 1, items.length - 1)]?.focus();
          } else if (event.key === "ArrowUp") {
            items[Math.max(index - 1, 0)]?.focus();
          } else {
            target.click();
          }
        }}
      >
        {children}
      </nav>
    </TreeContext>
  );
};

export const FileTree = ({
  className,
  data,
  expandDepth = 0,
  expandExclude,
  fileActions,
  initialSelectedItemId,
  log,
  onDoubleClick,
  onSelectChange,
  selectedId,
}: {
  className?: string;
  data: TreeDataItem | TreeDataItem[];
  expandDepth?: number;
  expandExclude?: string[];
  fileActions?: FileActions;
  initialSelectedItemId?: string;
  log?: (msg: string) => void;
  onDoubleClick?: (item: TreeDataItem) => void;
  onSelectChange?: (item: TreeDataItem | undefined) => void;
  selectedId?: null | string;
}) => {
  const items = Array.isArray(data) ? data : [data];
  return (
    <Tree
      className={className}
      expandDepth={expandDepth}
      expandExclude={expandExclude}
      fileActions={fileActions}
      log={log}
      selectedId={selectedId ?? initialSelectedItemId}
    >
      <div className="min-w-max">
        {renderItems({
          items,
          onItemClick: onSelectChange,
          onItemDoubleClick: onDoubleClick,
        })}
      </div>
    </Tree>
  );
};
