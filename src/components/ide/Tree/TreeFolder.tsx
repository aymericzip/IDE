import { Accordion } from '@base-ui/react/accordion';
import { ClipboardCopy, Download } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../../context-menu';
import { cn } from '../../lib/utils';
import { ITEM_CLASS } from '../constants';
import { DepthContext } from '../IDEContext';
import { FolderIcon } from './TreeIcons';
import { useTreeItem } from './TreeItem';

export const TreeFolder = ({
  children,
  defaultOpen = false,
  disabled,
  id,
  name,
  path,
  className,
}: {
  children?: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  disabled?: boolean;
  id?: string;
  name: string;
  path?: string;
}) => {
  const {
    depth,
    expandDepth,
    expandExclude,
    fileActions,
    iconClass,
    indent,
    log: treeLog,
    isMultiSelected,
    isSelected,
    itemId,
    pl,
    select,
  } = useTreeItem({ id, name, path });

  const folderPath = path ?? name;
  const excluded = expandExclude?.some((ex) => folderPath.startsWith(ex));
  const shouldOpen = !excluded && (defaultOpen || depth < expandDepth);
  const [open, setOpen] = useState(shouldOpen ? [itemId] : []);
  const isOpen = open.includes(itemId);

  return (
    <Accordion.Root
      onValueChange={(v) => {
        setOpen(v);
        treeLog?.(v.length > 0 ? `Expand: ${name}` : `Collapse: ${name}`);
      }}
      value={open}
    >
      <Accordion.Item value={itemId}>
        <ContextMenu>
          <ContextMenuTrigger>
            <Accordion.Trigger
              className={cn(
                ITEM_CLASS,
                (isSelected || isMultiSelected) && 'bg-accent',
                disabled && 'pointer-events-none opacity-50',
                className
              )}
              data-item-id={itemId}
              onClick={(e) => select(e)}
              role="treeitem"
              style={{ paddingLeft: pl }}
            >
              <FolderIcon className={iconClass} name={name} open={isOpen} />
              {name}
            </Accordion.Trigger>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {fileActions?.onDownload ? (
              <ContextMenuItem
                onClick={() => fileActions.onDownload?.(folderPath)}
              >
                <Download /> Download
              </ContextMenuItem>
            ) : null}
            {fileActions?.onDownload ? <ContextMenuSeparator /> : null}
            <ContextMenuItem
              onClick={() => {
                navigator.clipboard
                  .writeText(folderPath)
                  .then(() => toast('Copied to clipboard'))
                  .catch(() => undefined);
              }}
            >
              <ClipboardCopy /> Copy Path
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <Accordion.Panel className="relative h-(--accordion-panel-height) overflow-hidden transition-[height] duration-150 ease-out data-ending-style:h-0 data-starting-style:h-0">
          <span
            className="absolute top-0 bottom-0 w-px bg-accent"
            style={{ left: `${String(depth * indent + 16)}px` }}
          />
          <DepthContext value={depth + 1}>{children}</DepthContext>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  );
};
