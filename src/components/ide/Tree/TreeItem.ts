import { use } from 'react';
import { ICON_CLASS_HOVER } from '../constants';
import { DepthContext, EMPTY_SET, TreeContext } from '../IDEContext';

export const useTreeItem = ({
  id,
  name,
  path,
}: {
  id?: string;
  name: string;
  path?: string;
}) => {
  const {
    expandDepth,
    expandExclude,
    fileActions,
    indent,
    log: treeLog,
    onSelect,
    selectedId,
    navRef,
    selectedIds,
    setSelectedId,
    setSelectedIds,
  } = use(TreeContext);

  const depth = use(DepthContext);
  const itemId = id ?? path ?? name;

  const isSelected =
    selectedIds.size > 0 ? selectedIds.has(itemId) : selectedId === itemId;
  const isMultiSelected = selectedIds.has(itemId);
  const paddingLeft = `${String(depth * indent + 8)}px`;

  const select = (event?: { metaKey?: boolean; shiftKey?: boolean }) => {
    if (event?.metaKey) {
      const nextSelectedIds = new Set(selectedIds);

      if (nextSelectedIds.size === 0 && selectedId) {
        nextSelectedIds.add(selectedId);
      }

      if (nextSelectedIds.has(itemId)) {
        nextSelectedIds.delete(itemId);
      } else {
        nextSelectedIds.add(itemId);
      }

      setSelectedIds(nextSelectedIds);
    } else if (event?.shiftKey && selectedId && navRef.current) {
      const elements =
        navRef.current.querySelectorAll<HTMLElement>("[data-item-id]");
      const ids = [...elements].map((element) => element.dataset.itemId ?? "");
      const fromIndex = ids.indexOf(selectedId);
      const toIndex = ids.indexOf(itemId);

      if (fromIndex !== -1 && toIndex !== -1) {
        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);
        setSelectedIds(new Set(ids.slice(start, end + 1)));
      }
    } else {
      setSelectedIds(EMPTY_SET);
      setSelectedId(itemId);
      onSelect?.({ id: itemId, name, path: path ?? name });
    }
  };

  return {
    depth,
    expandDepth,
    expandExclude,
    fileActions,
    iconClass: ICON_CLASS_HOVER,
    indent,
    isMultiSelected,
    isSelected,
    itemId,
    log: treeLog,
    paddingLeft,
    select,
    selectedIds,
  };
};
