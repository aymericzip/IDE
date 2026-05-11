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
  const parameters = params as any;
  const dockviewApi = use(DockviewApiContext);
  const previewId = useAtomValue(previewPanelAtom);
  const [pinnedTabs, setPinnedTabs] = useAtom(pinnedTabsAtom);

  const isPreview = previewId === api.id;
  const isPinned = pinnedTabs.includes(api.id);
  const showIcon = parameters?.icon !== false;
  const isClosable = parameters?.closable !== false && !isPinned;

  const [isActive, setIsActive] = useState(api.isActive);

  useEffect(() => {
    const disposable = api.onDidActiveChange((event) =>
      setIsActive(event.isActive),
    );
    return () => disposable.dispose();
  }, [api]);

  return (
    <ContextMenu>
      <ContextMenuTrigger
        className={cn(
          "group/tab flex h-full items-center gap-[3px] py-[3px] pl-1 text-xs",
          parameters?.headerClassName,
          isActive
            ? parameters?.activeClassName
            : ["text-muted-foreground", parameters?.inactiveClassName],
        )}
        data-fill={parameters?.headerClassName ? "" : undefined}
        data-preview={isPreview ? "" : undefined}
        onMouseDown={(event) => {
          if (event.button === 1 && isClosable) {
            event.preventDefault();
            api.close();
          }
        }}
      >
        {showIcon ? (
          <FileIcon
            className={ICON_CLASS_TAB_HOVER}
            name={parameters?.iconName ?? api.title ?? ""}
          />
        ) : null}
        {api.title}
        {isPinned ? (
          <Pin
            className="-ml-1 size-4 rotate-45 p-0.5 opacity-50 transition-all hover:cursor-pointer hover:p-0 hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation();
              setPinnedTabs((prev) => prev.filter((id) => id !== api.id));
            }}
          />
        ) : isClosable ? (
          <X
            className="-ml-1 size-4 p-0.5 opacity-0 transition-all hover:cursor-pointer hover:p-0 hover:text-red-500 hover:opacity-100 group-hover/tab:opacity-50"
            onClick={(event) => {
              event.stopPropagation();
              api.close();
            }}
          />
        ) : null}
      </ContextMenuTrigger>
      {dockviewApi ? (
        <ContextMenuContent>
          <ContextMenuItem onClick={() => api.close()}>
            <X /> Close <ContextMenuShortcut>⌥W</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              for (const panel of dockviewApi.panels) {
                if (panel.id !== api.id && !pinnedTabs.includes(panel.id)) {
                  try {
                    panel.api.close();
                  } catch {
                    /* Ignore close error */
                  }
                }
              }
            }}
          >
            <Trash /> Close Others
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              const index = dockviewApi.panels.findIndex(
                (panel) => panel.id === api.id,
              );

              for (let i = dockviewApi.panels.length - 1; i > index; i -= 1) {
                if (!pinnedTabs.includes(dockviewApi.panels[i].id)) {
                  try {
                    dockviewApi.panels[i].api.close();
                  } catch {
                    /* Ignore close error */
                  }
                }
              }
            }}
          >
            <ArrowRightToLine /> Close to the Right
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              for (let i = dockviewApi.panels.length - 1; i >= 0; i -= 1) {
                if (!pinnedTabs.includes(dockviewApi.panels[i].id)) {
                  try {
                    dockviewApi.panels[i].api.close();
                  } catch {
                    /* Ignore close error */
                  }
                }
              }
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
              const foundPanel = dockviewApi.panels.find(
                (panel) => panel.id === api.id,
              );

              if (foundPanel) {
                dockviewApi.addPanel({
                  component: foundPanel.view.contentComponent,
                  id: `${foundPanel.id}-split-${Date.now()}`,
                  params: foundPanel.params,
                  position: { direction: "right", referencePanel: foundPanel },
                  tabComponent: "default",
                  title: foundPanel.title ?? "",
                });
              }
            }}
          >
            <SplitSquareHorizontal /> Split Right
          </ContextMenuItem>
        </ContextMenuContent>
      ) : null}
    </ContextMenu>
  );
};
