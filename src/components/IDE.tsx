import 'dockview-core/dist/styles/dockview.css';
import { useHotkeys } from '@tanstack/react-hotkeys';
import type { DockviewApi, DockviewReadyEvent } from 'dockview-react';
import { DockviewReact } from 'dockview-react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { ChevronRight, ChevronsDownUp } from 'lucide-react';
import type { ComponentProps, ReactNode, Ref } from 'react';
import {
  Children,
  createElement,
  isValidElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
// Atoms & Context
import {
  closedTabsAtom,
  fontSizeAtom,
  openFileAtom,
  pinnedTabsAtom,
  previewPanelAtom,
  quickOpenAtom,
  treeAtom,
  wordWrapAtom,
} from './ide/atoms';
// Constants & Utils
import {
  BINARY_EXTS,
  CENTER,
  EDITOR_OPTIONS,
  FILE_SIZE_WARN,
  IMAGE_EXTS,
  RESET_CSS,
  TAB_TYPE,
  VIRTUAL_PREFIX,
} from './ide/constants';
import { DockviewApiContext } from './ide/IDEContext';
import { ContentPanel } from './ide/Panels/ContentPanel';
import { FilePanel } from './ide/Panels/FilePanel';
import { ImagePanel } from './ide/Panels/ImagePanel';
import { WatermarkPanel } from './ide/Panels/WatermarkPanel';
import { QuickOpenDialog } from './ide/QuickOpenDialog';
import { StatusBar } from './ide/StatusBar';
import { Tab } from './ide/Tabs/Tab';
import { TabHeader } from './ide/Tabs/TabHeader';
// Components
import { FileTree } from './ide/Tree';
// Types
import type {
  FileActions,
  PanelPosition,
  TabProps,
  TreeDataItem,
  VirtualFile,
  WorkspaceRef,
} from './ide/types';
import {
  deduplicateTitle,
  extOf,
  extractTabs,
  getTabId,
  initMonaco,
  langOf,
  resolveLanguageIcon,
  useAltKeys,
  virtualFileId,
} from './ide/utils';
import { cn } from './lib/utils';
import { Toaster } from './sonner';

const EMPTY_TREE: TreeDataItem[] = [];
const COMPONENTS = { custom: ContentPanel, file: FilePanel, image: ImagePanel };
const TAB_COMPONENTS = { default: TabHeader };

export const Workspace = ({
  activityLog,
  children,
  defaultSidebar = true,
  editorOptions,
  expandDepth = 0,
  expandExclude,
  fileActions,
  files,
  initialFiles,
  onFilesChange,
  onOpenFile,
  onSidebarChange,
  onTabChange,
  ref,
  renderLoading,
  shortcuts = true,
  sidebar: controlledSidebar,
  sidebarPosition = 'left',
  sidebarSize = 150,
  theme,
  tree,
  ...props
}: Omit<ComponentProps<'div'>, 'ref'> & {
  activityLog?: (line: string) => void;
  defaultSidebar?: boolean;
  editorOptions?: Record<string, unknown>;
  expandDepth?: number;
  expandExclude?: string[];
  fileActions?: FileActions;
  files?: VirtualFile[];
  initialFiles?: string[];
  onFilesChange?: (files: string[]) => void;
  onOpenFile?: (item: TreeDataItem) => null | Promise<null | string> | string;
  onSidebarChange?: (visible: boolean) => void;
  onTabChange?: (id: string) => void;
  ref?: Ref<WorkspaceRef>;
  renderLoading?: (item: TreeDataItem) => ReactNode;
  shortcuts?: boolean;
  sidebar?: boolean;
  sidebarPosition?: 'left' | 'right';
  sidebarSize?: number;
  theme?: string | { dark: string; light: string };
  tree?: TreeDataItem[];
}) => {
  const [mounted, setMounted] = useState(false);
  const [activeFileId, setActiveFileId] = useState<null | string>(null);
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [treeKey, setTreeKey] = useState(0);

  const [internalWordWrap, setInternalWordWrap] = useAtom(wordWrapAtom);
  const [dockviewApi, setDockviewApi] = useState<DockviewApi | null>(null);
  const [currentPreviewId, setPreviewId] = useAtom(previewPanelAtom);
  const previewIdRef = useRef(currentPreviewId);
  const [closedTabs, setClosedTabs] = useAtom(closedTabsAtom);
  const pinnedTabsValue = useAtomValue(pinnedTabsAtom);
  const pinnedTabsRef = useRef(pinnedTabsValue);

  const historyRef = useRef<{
    entries: string[];
    index: number;
    navigating: boolean;
  }>({
    entries: [],
    index: -1,
    navigating: false,
  });

  const quickOpenVisible = useAtomValue(quickOpenAtom);
  const setQuickOpen = useSetAtom(quickOpenAtom);
  const setTreeData = useSetAtom(treeAtom);
  const setOpenFileFn = useSetAtom(openFileAtom);
  const [fontSizeDelta, setFontSizeDelta] = useAtom(fontSizeAtom);

  const log = useCallback(
    (msg: string) => {
      activityLog?.(msg);
    },
    [activityLog]
  );

  const [internalSidebar, setInternalSidebar] = useState(defaultSidebar);
  const sidebarVisible = controlledSidebar ?? internalSidebar;

  const toggleSidebar = useCallback(() => {
    const next = !sidebarVisible;
    setInternalSidebar(next);
    onSidebarChange?.(next);
    log(next ? 'Sidebar opened' : 'Sidebar closed');
  }, [log, onSidebarChange, sidebarVisible]);

  const stateRef = useRef({
    api: null as DockviewApi | null,
    disposables: [] as { dispose: () => void }[],
    fileIds: new Set<string>(),
    onCloseMap: new Map<string, () => void>(),
    prevTabIds: new Set<string>(),
    ready: false,
  });

  const onFilesChangeRef = useRef(onFilesChange);
  const onOpenFileRef = useRef(onOpenFile);
  const renderLoadingRef = useRef(renderLoading);
  const editorOptionsRef = useRef(editorOptions);
  const themeRef = useRef(theme);
  const filesRef = useRef(files);
  const onTabChangeRef = useRef(onTabChange);

  const mergedEditorOptions = useMemo(
    () => ({
      ...editorOptions,
      fontSize: (EDITOR_OPTIONS.fontSize ?? 14) + fontSizeDelta,
      wordWrap: (internalWordWrap ? 'on' : 'off') as any,
    }),
    [editorOptions, fontSizeDelta, internalWordWrap]
  );

  useEffect(() => {
    onFilesChangeRef.current = onFilesChange;
    onOpenFileRef.current = onOpenFile;
    renderLoadingRef.current = renderLoading;
    editorOptionsRef.current = mergedEditorOptions;
    themeRef.current = theme;
    filesRef.current = files;
    previewIdRef.current = currentPreviewId;
    pinnedTabsRef.current = pinnedTabsValue;
    onTabChangeRef.current = onTabChange;
  });

  useEffect(() => {
    const { api } = stateRef.current;
    if (!api) return;
    for (const panel of api.panels)
      if (stateRef.current.fileIds.has(panel.id))
        panel.api.updateParameters({ editorOptions: mergedEditorOptions });
  }, [mergedEditorOptions]);

  useEffect(() => {
    setMounted(true);
    const observer = new MutationObserver(() => {
      log(
        `Theme: ${document.documentElement.classList.contains('dark') ? 'dark' : 'light'}`
      );
    });
    observer.observe(document.documentElement, {
      attributeFilter: ['class'],
      attributes: true,
    });
    return () => {
      observer.disconnect();
      for (const d of stateRef.current.disposables) d.dispose();
      stateRef.current = {
        ...stateRef.current,
        disposables: [],
        fileIds: new Set(),
        onCloseMap: new Map(),
        prevTabIds: new Set(),
        ready: false,
      };
    };
  }, [log]);

  const openVirtualFile = useCallback((file: VirtualFile) => {
    const { api } = stateRef.current;
    if (!api) return;

    const id = virtualFileId(file.name);
    const existing = api.panels.find((p) => p.id === id);
    if (existing) {
      existing.focus();
      return;
    }

    const existingFile = api.panels.find((p) =>
      stateRef.current.fileIds.has(p.id)
    );
    const position: PanelPosition | undefined = existingFile
      ? ({
          direction: 'within',
          referenceGroup: existingFile.group.id,
        } as unknown as PanelPosition)
      : undefined;

    stateRef.current.fileIds.add(id);
    const lang = file.language ?? langOf(file.name);
    const iconName = file.language ? `file.${file.language}` : file.name;

    api.addPanel({
      component: 'file',
      id,
      params: {
        content: file.content,
        editorOptions: editorOptionsRef.current,
        iconName,
        language: lang,
        theme: themeRef.current,
      },
      position: position as any,
      tabComponent: 'default',
      title: file.name,
    });
  }, []);

  const openFileInPanel = useCallback(
    (item: TreeDataItem, preview: boolean) => {
      const { api } = stateRef.current;
      const onOpen = onOpenFileRef.current;
      if (!api) {
        log('openFileInPanel: no api');
        return;
      }
      if (!onOpen) {
        log('openFileInPanel: no onOpenFile callback');
        return;
      }

      const existing = api.panels.find((p) => p.id === item.path);
      if (existing) {
        existing.focus();
        if (!preview) {
          setPreviewId((prev) => (prev === item.path ? null : prev));
          log(`Pinned: ${item.name}`);
        }
        return;
      }

      log(`${preview ? 'Preview' : 'Open'}: ${item.path}`);

      if (preview && previewIdRef.current) {
        const prev = api.panels.find((p) => p.id === previewIdRef.current);
        if (prev) {
          stateRef.current.fileIds.delete(prev.id);
          try {
            api.removePanel(prev);
          } catch {
            /* Already removed */
          }
        }
      }

      const loading = renderLoadingRef.current;
      const loadingNode = loading ? (
        loading(item)
      ) : (
        <div className={cn(CENTER, 'text-muted-foreground text-xs')}>
          Loading...
        </div>
      );

      const existingFile = api.panels.find((p) =>
        stateRef.current.fileIds.has(p.id)
      );
      const position: PanelPosition | undefined = existingFile
        ? ({
            direction: 'within',
            referenceGroup: existingFile.group.id,
          } as unknown as PanelPosition)
        : undefined;

      stateRef.current.fileIds.add(item.path);
      setPreviewId(preview ? item.path : null);
      previewIdRef.current = preview ? item.path : null;

      const ext = extOf(item.path);
      const isImage = IMAGE_EXTS.has(ext);
      const isBinary = BINARY_EXTS.has(ext);
      const title = deduplicateTitle(item.name, item.path, api.panels);

      if (isBinary) {
        api.addPanel({
          component: 'custom',
          id: item.path,
          params: {
            content: createElement(
              'div',
              { className: cn(CENTER, 'h-full text-muted-foreground text-xs') },
              'Binary file — cannot display'
            ),
            iconName: item.name,
          },
          position: position as any,
          tabComponent: 'default',
          title,
        });
        log(`Binary: ${item.path}`);
        return;
      }

      if (isImage) {
        const result = onOpen(item);
        const addImagePanel = (src: string) => {
          api.addPanel({
            component: 'image',
            id: item.path,
            params: { iconName: item.name, src },
            position: position as any,
            tabComponent: 'default',
            title,
          });
          log(`Image: ${item.path}`);
        };
        if (result === null) return;
        if (typeof result === 'string') addImagePanel(result);
        else
          result
            .then((r) => {
              if (r) addImagePanel(r);
            })
            .catch(() => undefined);
        return;
      }

      const added = api.addPanel({
        component: 'file',
        id: item.path,
        params: {
          content: '',
          editorOptions: editorOptionsRef.current,
          iconName: item.name,
          language: langOf(item.path),
          loading: loadingNode,
          theme: themeRef.current,
        },
        position: position as any,
        tabComponent: 'default',
        title,
      });

      const result = onOpen(item);
      if (result === null) {
        log(`Load returned null: ${item.path}`);
        return;
      }

      if (typeof result === 'string') {
        if (result.length > FILE_SIZE_WARN)
          log(
            `Large file: ${item.path} (${Math.round(result.length / 1024)} KB)`
          );
        added.api.updateParameters({ content: result, loading: undefined });
        log(`Loaded: ${item.path} (${result.length} chars)`);
      } else {
        const panelPath = item.path;
        result
          .then((fileContent) => {
            try {
              const p = api.panels.find((x) => x.id === panelPath);
              if (!p) return;
              if (fileContent === null) {
                p.api.updateParameters({
                  content:
                    '// Failed to load file from repository. It might be empty, or you might be rate limited.',
                  loading: undefined,
                });
                log(`Load failed: ${panelPath}`);
              } else {
                if (fileContent.length > FILE_SIZE_WARN)
                  log(
                    `Large file: ${panelPath} (${Math.round(fileContent.length / 1024)} KB)`
                  );
                p.api.updateParameters({
                  content: fileContent,
                  loading: undefined,
                });
                log(`Loaded: ${panelPath} (${fileContent.length} chars)`);
              }
            } catch {
              /* Already removed */
            }
          })
          .catch(() => {
            try {
              const p = api.panels.find((x) => x.id === panelPath);
              if (p)
                p.api.updateParameters({
                  content: '// Error loading file.',
                  loading: undefined,
                });
              log(`Load error: ${panelPath}`);
            } catch {
              /* Already removed */
            }
          });
      }
    },
    [log, setPreviewId]
  );

  const openFile = useCallback(
    (item: TreeDataItem) => openFileInPanel(item, true),
    [openFileInPanel]
  );

  const pinFile = useCallback(
    (item: TreeDataItem) => openFileInPanel(item, false),
    [openFileInPanel]
  );

  const tabs = useMemo(() => extractTabs(children), [children]);

  const addTab = useCallback((tab: TabProps) => {
    const { api } = stateRef.current;
    if (!api) return;
    const tabId = getTabId(tab);
    const existing = api.panels.find((p) => p.id === tabId);
    if (existing) {
      existing.api.updateParameters({ content: tab.children });
      return;
    }
    api.addPanel({
      component: 'custom',
      id: tabId,
      params: {
        activeClassName: tab.activeClassName,
        closable: tab.closable,
        content: tab.children,
        headerClassName: tab.headerClassName,
        icon: tab.icon,
        inactiveClassName: tab.inactiveClassName,
      },
      tabComponent: 'default',
      title: tab.title,
    });
  }, []);

  useHotkeys(
    [
      { callback: () => toggleSidebar(), hotkey: 'Mod+B' },
      {
        callback: () => {
          setQuickOpen((v) => !v);
          log('Quick open toggled');
        },
        hotkey: 'Mod+P',
      },
      {
        callback: () => {
          const panel = stateRef.current.api?.activePanel;
          if (panel) {
            stateRef.current.api?.addPanel({
              component: panel.view.contentComponent,
              id: `${panel.id}-split-${Date.now()}`,
              params: panel.params,
              position: { direction: 'right', referencePanel: panel },
              tabComponent: 'default',
              title: panel.title ?? '',
            });
            log(`Split: ${panel.title ?? panel.id}`);
          }
        },
        hotkey: 'Mod+\\',
      },
      {
        callback: () => {
          setFontSizeDelta((d) => d + 2);
          log('Zoom in');
        },
        hotkey: 'Mod+=',
      },
      {
        callback: () => {
          setFontSizeDelta((d) => d - 2);
          log('Zoom out');
        },
        hotkey: 'Mod+-',
      },
      {
        callback: () => {
          setFontSizeDelta(0);
          log('Zoom reset');
        },
        hotkey: 'Mod+0',
      },
      {
        callback: () => {
          const { api } = stateRef.current;
          if (!api) return;
          let closed = 0;
          for (let i = api.panels.length - 1; i >= 0; i--) {
            if (!pinnedTabsRef.current.includes(api.panels[i].id))
              try {
                api.panels[i].api.close();
                closed++;
              } catch {}
          }
          log(
            `Closed ${closed} tabs (${pinnedTabsRef.current.length} pinned kept)`
          );
        },
        hotkey: 'Mod+Shift+W',
      },
      {
        callback: () => {
          const lastPath = closedTabs.at(-1);
          if (!lastPath) return;
          setClosedTabs((prev) => prev.slice(0, -1));
          pinFile({
            id: lastPath,
            name: lastPath.split('/').pop() ?? lastPath,
            path: lastPath,
          });
          log(`Reopened: ${lastPath}`);
        },
        hotkey: 'Mod+Shift+T',
      },
    ],
    { enabled: shortcuts, preventDefault: true }
  );

  useAltKeys(
    {
      ArrowLeft: () => {
        const h = historyRef.current;
        if (h.index <= 0) return;
        h.index--;
        h.navigating = true;
        const panel = stateRef.current.api?.panels.find(
          (p) => p.id === h.entries[h.index]
        );
        if (panel) {
          panel.focus();
          log(`Back: ${panel.title ?? panel.id}`);
        }
        h.navigating = false;
      },
      ArrowRight: () => {
        const h = historyRef.current;
        if (h.index >= h.entries.length - 1) return;
        h.index++;
        h.navigating = true;
        const panel = stateRef.current.api?.panels.find(
          (p) => p.id === h.entries[h.index]
        );
        if (panel) {
          panel.focus();
          log(`Forward: ${panel.title ?? panel.id}`);
        }
        h.navigating = false;
      },
      KeyE: () => {
        const { api } = stateRef.current;
        if (!api || api.panels.length < 2) return;
        const active = api.activePanel;
        const idx = active ? api.panels.indexOf(active) : -1;
        const next = api.panels[(idx + 1) % api.panels.length];
        next.focus();
        log(`Cycle tab: ${next.title ?? next.id}`);
      },
      KeyT: () => {
        const lastPath = closedTabs.at(-1);
        if (!lastPath) return;
        setClosedTabs((prev) => prev.slice(0, -1));
        pinFile({
          id: lastPath,
          name: lastPath.split('/').pop() ?? lastPath,
          path: lastPath,
        });
        log(`Reopened: ${lastPath}`);
      },
      KeyW: () => {
        const panel = stateRef.current.api?.activePanel;
        if (panel) {
          log(`Close tab: ${panel.title ?? panel.id}`);
          panel.api.close();
        }
      },
      KeyZ: () => {
        setInternalWordWrap((w) => !w);
        log('Word wrap toggled');
      },
    },
    shortcuts
  );

  useEffect(() => {
    setTreeData(tree ?? EMPTY_TREE);
  }, [tree, setTreeData]);

  useEffect(() => {
    setOpenFileFn(() => pinFile);
  }, [pinFile, setOpenFileFn]);

  useImperativeHandle(
    ref,
    () => ({
      focusPanel: (id: string) =>
        stateRef.current.api?.panels.find((p) => p.id === id)?.focus(),
      openFile: pinFile,
      toggleSidebar,
    }),
    [pinFile, toggleSidebar]
  );

  useEffect(() => {
    const { api } = stateRef.current;
    if (!api) return;
    const currentIds = new Set(tabs.map(getTabId));
    for (const id of stateRef.current.prevTabIds) {
      if (!currentIds.has(id)) {
        const p = api.panels.find((panel) => panel.id === id);
        if (p) api.removePanel(p);
      }
    }
    for (const tab of tabs) {
      const tid = getTabId(tab);
      if (stateRef.current.prevTabIds.has(tid)) {
        api.panels
          .find((p) => p.id === tid)
          ?.api.updateParameters({ content: tab.children });
      } else {
        addTab(tab);
      }
    }
    stateRef.current.prevTabIds = currentIds;
    stateRef.current.onCloseMap.clear();
    for (const tab of tabs)
      if (tab.onClose)
        stateRef.current.onCloseMap.set(getTabId(tab), tab.onClose);
  }, [addTab, tabs]);

  useEffect(() => {
    const { api } = stateRef.current;
    if (!(api && files)) return;
    const tid = setTimeout(() => {
      const activeIds = new Set(files.map((f) => virtualFileId(f.name)));
      for (const panel of api.panels)
        if (panel.id.startsWith(VIRTUAL_PREFIX) && !activeIds.has(panel.id))
          try {
            api.removePanel(panel);
          } catch {}
      for (const file of files) {
        const id = virtualFileId(file.name);
        api.panels
          .find((p) => p.id === id)
          ?.api.updateParameters({ content: file.content });
      }
    }, 100);
    return () => clearTimeout(tid);
  }, [files]);

  const handleReady = (event: DockviewReadyEvent) => {
    stateRef.current.api = event.api;
    setDockviewApi(event.api);
    for (const tab of tabs) addTab(tab);
    stateRef.current.prevTabIds = new Set(tabs.map(getTabId));
    for (const tab of tabs)
      if (tab.onClose)
        stateRef.current.onCloseMap.set(getTabId(tab), tab.onClose);

    if (filesRef.current) {
      for (const f of filesRef.current)
        if (f.open) {
          openVirtualFile(f);
          log(`Virtual file: ${f.name}`);
        }
    }

    requestAnimationFrame(() => {
      if (initialFiles) {
        log(`Opening files: ${initialFiles.join(', ')}`);
        for (const fpath of initialFiles) {
          pinFile({
            id: fpath,
            name: fpath.split('/').pop() ?? fpath,
            path: fpath,
          });
        }
        requestAnimationFrame(() => {
          const first = event.api.panels.find((p) => p.id === initialFiles[0]);
          if (first) first.focus();
        });
      }
    });
    log('Workspace ready');

    const notifyFiles = () => {
      if (!stateRef.current.ready) return;
      onFilesChangeRef.current?.([...stateRef.current.fileIds]);
    };

    stateRef.current.disposables.push(
      event.api.onDidRemovePanel((e) => {
        stateRef.current.fileIds.delete(e.id);
        stateRef.current.onCloseMap.get(e.id)?.();
        stateRef.current.onCloseMap.delete(e.id);
        initMonaco()
          .then((m) => {
            const model = m.editor.getModel(m.Uri.parse(e.id));
            if (model) model.dispose();
          })
          .catch(() => undefined);
        if (previewIdRef.current === e.id) {
          setPreviewId(null);
          previewIdRef.current = null;
        }
        if (!e.id.startsWith(VIRTUAL_PREFIX))
          setClosedTabs((prev) => [...prev.slice(-19), e.id]);
        log(`Closed: ${e.title ?? e.id}`);
        notifyFiles();
      }),
      event.api.onDidAddPanel((e) => {
        log(`Opened tab: ${e.title ?? e.id}`);
        notifyFiles();
      }),
      event.api.onDidActivePanelChange((e) => {
        if (e?.id) {
          setActiveFileId(e.id);
          onTabChangeRef.current?.(e.id);
          if (!historyRef.current.navigating) {
            const h = historyRef.current;
            if (h.entries[h.index] !== e.id) {
              h.entries = [...h.entries.slice(0, h.index + 1), e.id].slice(-50);
              h.index = h.entries.length - 1;
            }
          }
          log(`Focused: ${e.title ?? e.id}`);
        }
      })
    );
    stateRef.current.ready = true;
  };

  const mergedTree = useMemo(() => {
    if (!(tree || (files && files.length > 0))) return tree;
    const toItem = (f: VirtualFile): TreeDataItem => ({
      icon:
        f.icon ?? (f.language ? resolveLanguageIcon(f.language) : undefined),
      id: virtualFileId(f.name),
      name: f.name,
      path: virtualFileId(f.name),
    });
    const top = files?.filter((f) => f.pin === 'top').map(toItem) ?? [];
    const mid = files?.filter((f) => !f.pin).map(toItem) ?? [];
    const bottom = files?.filter((f) => f.pin === 'bottom').map(toItem) ?? [];
    return [...top, ...mid, ...(tree ?? []), ...bottom];
  }, [files, tree]);

  const sidebarChildren = useMemo(() => {
    const items: ReactNode[] = [];
    Children.forEach(children, (child) => {
      if (!(isValidElement(child) && (child.type as any)._type === TAB_TYPE)) {
        items.push(child);
      }
    });
    return items;
  }, [children]);

  if (!mounted) return null;

  const sidebarContent = mergedTree ? (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-muted-foreground text-xs uppercase">
          explorer
        </span>
        <button
          className="p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => {
            log(treeCollapsed ? 'Tree expanded all' : 'Tree collapsed all');
            setTreeCollapsed((c) => !c);
            setTreeKey((k) => k + 1);
          }}
          title={treeCollapsed ? 'Expand All' : 'Collapse All'}
          type="button"
        >
          {treeCollapsed ? (
            <ChevronRight className="size-4 stroke-1" />
          ) : (
            <ChevronsDownUp className="size-4 stroke-1" />
          )}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <FileTree
          data={mergedTree}
          expandDepth={treeCollapsed ? 0 : expandDepth}
          expandExclude={expandExclude}
          fileActions={fileActions}
          key={treeKey}
          log={log}
          onDoubleClick={(item) => {
            if (item.children) return;
            if (!item.id.startsWith(VIRTUAL_PREFIX)) {
              pinFile(item);
              log(`Double-click pinned: ${item.name}`);
            }
          }}
          onSelectChange={(item) => {
            if (!item) return;
            if (item.children) {
              log(`Folder: ${item.name}`);
              return;
            }
            if (item.id.startsWith(VIRTUAL_PREFIX)) {
              const vf = files?.find((f) => virtualFileId(f.name) === item.id);
              if (vf) openVirtualFile(vf);
            } else openFile(item);
          }}
          selectedId={activeFileId}
        />
      </div>
    </div>
  ) : (
    sidebarChildren
  );

  const sidePanel = sidebarVisible ? (
    <>
      {sidebarPosition === 'right' ? <Separator className="" /> : null}
      <Panel defaultSize={sidebarSize} minSize={10}>
        <div
          className={cn(
            'h-full bg-muted/70',
            sidebarPosition === 'left' ? 'border-r' : 'border-l'
          )}
        >
          {sidebarContent}
        </div>
      </Panel>
      {sidebarPosition === 'left' ? <Separator className="" /> : null}
    </>
  ) : null;

  return (
    <Group orientation="horizontal" className={props.className}>
      <style>{RESET_CSS}</style>
      {sidebarPosition === 'left' ? sidePanel : null}
      <Panel minSize={20}>
        <div className="flex h-full flex-col">
          <DockviewApiContext value={dockviewApi}>
            <DockviewReact
              className="dv-reset flex-1"
              components={COMPONENTS}
              onReady={handleReady}
              tabComponents={TAB_COMPONENTS}
              watermarkComponent={WatermarkPanel}
            />
          </DockviewApiContext>
          <StatusBar />
        </div>
      </Panel>
      {sidebarPosition === 'right' ? sidePanel : null}
      <QuickOpenDialog
        log={log}
        onOpenFile={(item) => {
          if (item.id.startsWith(VIRTUAL_PREFIX)) {
            const vf = files?.find((f) => virtualFileId(f.name) === item.id);
            if (vf) openVirtualFile(vf);
          } else openFile(item);
        }}
        open={quickOpenVisible}
        tree={mergedTree ?? EMPTY_TREE}
      />
      <Toaster />
    </Group>
  );
};

export type WorkspaceProps = ComponentProps<typeof Workspace>;

export const IDE = (props: WorkspaceProps) => {
  if (typeof window === 'undefined') return null;
  return <Workspace {...props} />;
};

IDE.Tab = Tab;
IDE.Tree = FileTree;
IDE.Folder = Panel;

export { Tab } from './ide/Tabs/Tab';
export { FileTree, Tree, TreeFile, TreeFolder } from './ide/Tree';
// Re-export everything for compatibility
export { FileIcon, FolderIcon } from './ide/Tree/TreeIcons';
export { getIconSvg } from './ide/utils';
export type { FileActions, TreeDataItem, VirtualFile, WorkspaceRef };
