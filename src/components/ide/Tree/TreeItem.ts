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
  const pl = `${String(depth * indent + 8)}px`;

  const select = (e?: { metaKey?: boolean; shiftKey?: boolean }) => {
    if (e?.metaKey) {
      const next = new Set(selectedIds);
      if (next.size === 0 && selectedId) next.add(selectedId);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      setSelectedIds(next);
    } else if (e?.shiftKey && selectedId && navRef.current) {
      const els =
        navRef.current.querySelectorAll<HTMLElement>('[data-item-id]');
      const ids = [...els].map((el) => el.dataset.itemId ?? '');
      const fromIdx = ids.indexOf(selectedId);
      const toIdx = ids.indexOf(itemId);
      if (fromIdx !== -1 && toIdx !== -1) {
        const start = Math.min(fromIdx, toIdx);
        const end = Math.max(fromIdx, toIdx);
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
    pl,
    select,
    selectedIds,
  };
};
