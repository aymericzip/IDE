import { ClipboardCopy, Download } from 'lucide-react';
import type { ComponentProps, ComponentType } from 'react';
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
import { getSvg } from '../utils';
import { FileIcon } from './TreeIcons';
import { useTreeItem } from './TreeItem';

export const TreeFile = ({
  disabled,
  icon,
  id,
  name,
  path,
  ...props
}: Omit<ComponentProps<'button'>, 'id'> & {
  disabled?: boolean;
  icon?: ComponentType<{ className?: string }> | string;
  id?: string;
  name: string;
  path?: string;
}) => {
  const {
    fileActions,
    iconClass,
    isMultiSelected,
    isSelected,
    itemId,
    paddingLeft,
    select,
  } = useTreeItem({ id, name, path });

  const CustomIcon = typeof icon === "function" ? icon : undefined;

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <button
          data-item-id={itemId}
          role="treeitem"
          type="button"
          {...props}
          className={cn(
            ITEM_CLASS,
            (isSelected || isMultiSelected) && "bg-accent",
            disabled && "pointer-events-none opacity-50",
            props.className,
          )}
          onClick={(event) => {
            if (!disabled) {
              select(event);
            }
            props.onClick?.(event);
          }}
          style={{ paddingLeft, ...props.style }}
        >
          {CustomIcon ? (
            <CustomIcon className={iconClass} />
          ) : typeof icon === 'string' ? (
            <span
              className={iconClass}
              dangerouslySetInnerHTML={{ __html: getSvg(icon) }}
            />
          ) : (
            <FileIcon className={iconClass} name={name} />
          )}
          {name}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {fileActions?.onDownload ? (
          <ContextMenuItem
            onClick={() => fileActions.onDownload?.(path ?? name)}
          >
            <Download /> Download
          </ContextMenuItem>
        ) : null}
        {fileActions?.onDownload ? <ContextMenuSeparator /> : null}
        <ContextMenuItem
          onClick={() => {
            navigator.clipboard
              .writeText(path ?? name)
              .then(() => toast('Copied to clipboard'))
              .catch(() => undefined);
          }}
        >
          <ClipboardCopy /> Copy Path
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
