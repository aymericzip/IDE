import { useAtomValue } from 'jotai';
import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbPage } from '../breadcrumb';
import { cn } from '../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';
import { openFileAtom, treeAtom } from './atoms';
import { ICON_CLASS } from './constants';
import { FileIcon, FolderIcon } from './Tree/TreeIcons';
import type { TreeDataItem } from './types';
import { findSiblings } from './utils';

export const BreadcrumbPickerItem = ({
  close,
  indent,
  item,
  openFileFn,
}: {
  close: () => void;
  indent: number;
  item: TreeDataItem;
  openFileFn: ((i: TreeDataItem) => void) | null;
}) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <button
        className="flex w-full items-center gap-1 text-left text-xs hover:bg-accent [&>:first-child]:mr-[-4px]"
        onClick={() => {
          if (item.children) setExpanded((e) => !e);
          else if (openFileFn) {
            openFileFn(item);
            close();
          }
        }}
        style={{ height: 22, paddingLeft: indent * 8 + 2 }}
        type="button"
      >
        {item.children ? (
          <ChevronRight
            className={cn(
              'size-3 shrink-0 transition-transform',
              expanded && 'rotate-90'
            )}
          />
        ) : (
          <span className="size-3 shrink-0" />
        )}
        {item.children ? (
          <FolderIcon className={ICON_CLASS} name={item.name} />
        ) : (
          <FileIcon className={ICON_CLASS} name={item.name} />
        )}
        <span className="truncate">{item.name}</span>
      </button>
      {expanded && item.children
        ? item.children.map((c) => (
            <BreadcrumbPickerItem
              close={close}
              indent={indent + 1}
              item={c}
              key={c.id}
              openFileFn={openFileFn}
            />
          ))
        : null}
    </>
  );
};

export const BreadcrumbSegment = ({
  depth,
  isLast,
  name,
  pathParts,
}: {
  depth: number;
  isLast: boolean;
  name: string;
  pathParts: string[];
}) => {
  const tree = useAtomValue(treeAtom);
  const openFileFn = useAtomValue(openFileAtom);
  const [open, setOpen] = useState(false);

  const siblings = useMemo(
    () => findSiblings(tree, pathParts, depth),
    [tree, pathParts, depth]
  );

  if (siblings.length === 0)
    return (
      <BreadcrumbItem>
        {isLast ? (
          <BreadcrumbPage>{name}</BreadcrumbPage>
        ) : (
          <BreadcrumbLink className="cursor-default">{name}</BreadcrumbLink>
        )}
      </BreadcrumbItem>
    );

  return (
    <BreadcrumbItem>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger className="cursor-pointer text-xs hover:text-foreground">
          {name}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="max-h-64 w-52 gap-0 overflow-y-auto p-0"
        >
          {siblings.map((s) => (
            <BreadcrumbPickerItem
              close={() => setOpen(false)}
              indent={0}
              item={s}
              key={s.id}
              openFileFn={openFileFn}
            />
          ))}
        </PopoverContent>
      </Popover>
    </BreadcrumbItem>
  );
};
