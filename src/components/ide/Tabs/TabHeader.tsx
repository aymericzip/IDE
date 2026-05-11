import type { IDockviewPanelHeaderProps } from 'dockview-react';
import { useAtom, useAtomValue } from 'jotai';
import {
  ArrowRightToLine,
  ClipboardCopy,
  Pin,
  PinOff,
  SplitSquareHorizontal,
  Trash,
  Trash2,
  X,
} from 'lucide-react';
import { use, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '../../context-menu';
import { cn } from '../../lib/utils';
import { pinnedTabsAtom, previewPanelAtom } from '../atoms';
import { ICON_CLASS_TAB_HOVER } from '../constants';
import { DockviewApiContext } from '../IDEContext';
import { FileIcon } from '../Tree/TreeIcons';

export const TabHeader = ({ api, params }: IDockviewPanelHeaderProps) => {
  const p = params as any;
  const dv = use(DockviewApiContext);
  const previewId = useAtomValue(previewPanelAtom);
  const [pinnedTabs, setPinnedTabs] = useAtom(pinnedTabsAtom);

  const isPreview = previewId === api.id;
  const isPinned = pinnedTabs.includes(api.id);
  const showIcon = p?.icon !== false;
  const closable = p?.closable !== false && !isPinned;

  const [active, setActive] = useState(api.isActive);
  useEffect(() => {
    const d = api.onDidActiveChange((e) => setActive(e.isActive));
    return () => d.dispose();
  }, [api]);

  return (
    <ContextMenu>
      <ContextMenuTrigger
        className={cn(
          'group/tab flex h-full items-center gap-[3px] py-[3px] pl-1 text-xs',
          p?.headerClassName,
          active
            ? p?.activeClassName
            : ['text-muted-foreground', p?.inactiveClassName]
        )}
        data-fill={p?.headerClassName ? '' : undefined}
        data-preview={isPreview ? '' : undefined}
        onMouseDown={(e) => {
          if (e.button === 1 && closable) {
            e.preventDefault();
            api.close();
          }
        }}
      >
        {showIcon ? (
          <FileIcon
            className={ICON_CLASS_TAB_HOVER}
            name={p?.iconName ?? api.title ?? ''}
          />
        ) : null}
        {api.title}
        {isPinned ? (
          <Pin
            className="-ml-1 size-4 rotate-45 p-0.5 opacity-50 transition-all hover:cursor-pointer hover:p-0 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              setPinnedTabs((prev) => prev.filter((id) => id !== api.id));
            }}
          />
        ) : closable ? (
          <X
            className="-ml-1 size-4 p-0.5 opacity-0 transition-all hover:cursor-pointer hover:p-0 hover:text-red-500 hover:opacity-100 group-hover/tab:opacity-50"
            onClick={(e) => {
              e.stopPropagation();
              api.close();
            }}
          />
        ) : null}
      </ContextMenuTrigger>
      {dv ? (
        <ContextMenuContent>
          <ContextMenuItem onClick={() => api.close()}>
            <X /> Close <ContextMenuShortcut>⌥W</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              for (const pnl of dv.panels)
                if (pnl.id !== api.id && !pinnedTabs.includes(pnl.id))
                  try {
                    pnl.api.close();
                  } catch {}
            }}
          >
            <Trash /> Close Others
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              const idx = dv.panels.findIndex((pnl) => pnl.id === api.id);
              for (let i = dv.panels.length - 1; i > idx; i -= 1)
                if (!pinnedTabs.includes(dv.panels[i].id))
                  try {
                    dv.panels[i].api.close();
                  } catch {}
            }}
          >
            <ArrowRightToLine /> Close to the Right
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              for (let i = dv.panels.length - 1; i >= 0; i -= 1)
                if (!pinnedTabs.includes(dv.panels[i].id))
                  try {
                    dv.panels[i].api.close();
                  } catch {}
            }}
          >
            <Trash2 /> Close All
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              navigator.clipboard
                .writeText(api.id)
                .then(() => toast('Copied to clipboard'))
                .catch(() => undefined);
            }}
          >
            <ClipboardCopy /> Copy Path
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() =>
              setPinnedTabs((prev) =>
                isPinned
                  ? prev.filter((id) => id !== api.id)
                  : [...prev, api.id]
              )
            }
          >
            {isPinned ? <PinOff /> : <Pin />} {isPinned ? 'Unpin' : 'Pin'}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              const found = dv.panels.find((pnl) => pnl.id === api.id);
              if (found)
                dv.addPanel({
                  component: found.view.contentComponent,
                  id: `${found.id}-split-${Date.now()}`,
                  params: found.params,
                  position: { direction: 'right', referencePanel: found },
                  tabComponent: 'default',
                  title: found.title ?? '',
                });
            }}
          >
            <SplitSquareHorizontal /> Split Right
          </ContextMenuItem>
        </ContextMenuContent>
      ) : null}
    </ContextMenu>
  );
};
