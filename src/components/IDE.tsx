import 'dockview-react/dist/styles/dockview.css';
import './IDE.css';
import { useHotkeys } from '@tanstack/react-hotkeys';
import type { DockviewApi, DockviewReadyEvent } from 'dockview-react';
import { DockviewReact } from 'dockview-react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { ChevronRight, ChevronsDownUp } from 'lucide-react';
// `preact/compat` types `isValidElement` as returning `boolean`; preact core
// types it as a type predicate, which is what narrows `ComponentChild` here.
import { isValidElement } from 'preact';
import type { ComponentProps, ReactNode, Ref } from 'react';
import {
  Children,
  createElement,
  forwardRef,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Group,
  Panel,
  type PanelImperativeHandle,
  type PanelSize,
  Separator,
} from 'react-resizable-panels';
import { Button } from './button';
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
  TAB_TYPE,
  VIRTUAL_PREFIX,
} from './ide/constants';
import { DockviewApiContext } from './ide/IDEContext';
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
import { Loader } from './loader';
import { Toaster } from './sonner';

const ContentPanel = lazy(() =>
  import('./ide/Panels/ContentPanel').then((mod) => ({
    default: mod.ContentPanel,
  }))
);
const FilePanel = lazy(() =>
  import('./ide/Panels/FilePanel').then((mod) => ({ default: mod.FilePanel }))
);
const ImagePanel = lazy(() =>
  import('./ide/Panels/ImagePanel').then((mod) => ({
    default: mod.ImagePanel,
  }))
);
const WatermarkPanel = lazy(() =>
  import('./ide/Panels/WatermarkPanel').then((mod) => ({
    default: mod.WatermarkPanel,
  }))
);

const SuspenseWrapper = (Component: any) => (props: any) => (
  <Suspense fallback={<Loader />}>
    <Component {...props} />
  </Suspense>
);

const LazyContentPanel = SuspenseWrapper(ContentPanel);
const LazyFilePanel = SuspenseWrapper(FilePanel);
const LazyImagePanel = SuspenseWrapper(ImagePanel);
const LazyWatermarkPanel = SuspenseWrapper(WatermarkPanel);

const EMPTY_TREE: TreeDataItem[] = [];
const COMPONENTS = {
  custom: LazyContentPanel,
  file: LazyFilePanel,
  image: LazyImagePanel,
};
const TAB_COMPONENTS = { default: TabHeader };

export type WorkspaceProps = Omit<ComponentProps<'div'>, 'ref'> & {
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
};

export const Workspace = forwardRef<WorkspaceRef, WorkspaceProps>(
  (
    {
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
    },
    forwardedRef
  ) => {
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

    const SIDEBAR_SIZE_STORAGE_KEY = 'ide:sidebar-size';

    const [memorizedSidebarSize] = useState<number>(() => {
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem(SIDEBAR_SIZE_STORAGE_KEY);
          if (saved) {
            const parsed = Number.parseFloat(saved);
            if (!Number.isNaN(parsed) && parsed > 20) return parsed;
          }
        } catch {}
      }
      return typeof sidebarSize === 'number' ? sidebarSize : 200;
    });

    /**
     * Last expanded width in pixels. `expand()` only restores the size captured
     * by an imperative `collapse()`, and falls back to `minSize` otherwise (a
     * panel mounted collapsed, or collapsed by dragging) — so re-opening resizes
     * to this width explicitly instead.
     */
    const lastSidebarSizeRef = useRef(memorizedSidebarSize);

    const sidebarPanelRef = useRef<PanelImperativeHandle | null>(null);
    const sidebarDivRef = useRef<HTMLDivElement | null>(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
      controlledSidebar !== undefined ? !controlledSidebar : !defaultSidebar
    );

    useEffect(() => {
      if (controlledSidebar === undefined || !sidebarPanelRef.current) return;
      const isCurrentlyCollapsed = sidebarPanelRef.current.isCollapsed();
      if (controlledSidebar && isCurrentlyCollapsed) {
        sidebarPanelRef.current.resize(lastSidebarSizeRef.current);
        setIsSidebarCollapsed(false);
      } else if (!controlledSidebar && !isCurrentlyCollapsed) {
        sidebarPanelRef.current.collapse();
        setIsSidebarCollapsed(true);
      }
    }, [controlledSidebar]);

    const toggleSidebar = useCallback(() => {
      if (!sidebarPanelRef.current) return;
      const isCollapsed = sidebarPanelRef.current.isCollapsed();
      if (isCollapsed) {
        sidebarPanelRef.current.resize(lastSidebarSizeRef.current);
        setIsSidebarCollapsed(false);
        onSidebarChange?.(true);
        log('Sidebar opened');
      } else {
        sidebarPanelRef.current.collapse();
        setIsSidebarCollapsed(true);
        onSidebarChange?.(false);
        log('Sidebar closed');
      }
    }, [log, onSidebarChange]);

    const handleSidebarResize = useCallback(
      (panelSize: PanelSize) => {
        const collapsed =
          panelSize.inPixels <= 0 || panelSize.asPercentage <= 0;
        setIsSidebarCollapsed(collapsed);
        onSidebarChange?.(!collapsed);
        if (!collapsed && panelSize.inPixels > 20) {
          lastSidebarSizeRef.current = panelSize.inPixels;
          try {
            localStorage.setItem(
              SIDEBAR_SIZE_STORAGE_KEY,
              String(Math.round(panelSize.inPixels))
            );
          } catch {}
        }
      },
      [onSidebarChange]
    );

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
      if (!api) {
        return;
      }

      for (const panel of api.panels) {
        if (stateRef.current.fileIds.has(panel.id)) {
          panel.api.updateParameters({ editorOptions: mergedEditorOptions });
        }
      }
    }, [mergedEditorOptions]);

    useEffect(() => {
      const observer = new MutationObserver(() => {
        log(
          `Theme: ${document.documentElement.getAttribute('data-theme') ?? 'unknown'}`
        );
      });
      observer.observe(document.documentElement, {
        attributeFilter: ['class'],
        attributes: true,
      });
      return () => {
        observer.disconnect();

        for (const disposable of stateRef.current.disposables) {
          disposable.dispose();
        }

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
        position,
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
          const previousPreview = api.panels.find(
            (panel) => panel.id === previewIdRef.current
          );

          if (previousPreview) {
            stateRef.current.fileIds.delete(previousPreview.id);

            try {
              api.removePanel(previousPreview);
            } catch {
              /* Already removed */
            }
          }
        }

        const loading = renderLoadingRef.current;
        const loadingNode = loading ? loading(item) : <Loader />;

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

        const extension = extOf(item.path);
        const isImage = IMAGE_EXTS.has(extension);
        const isBinary = BINARY_EXTS.has(extension);
        const title = deduplicateTitle(item.name, item.path, api.panels);

        if (isBinary) {
          api.addPanel({
            component: 'custom',
            id: item.path,
            params: {
              content: createElement(
                'div',
                {
                  className: cn(CENTER, 'h-full text-muted-foreground text-xs'),
                },
                'Binary file — cannot display'
              ),
              iconName: item.name,
            },
            position,
            tabComponent: 'default',
            title,
          });
          log(`Binary: ${item.path}`);
          return;
        }

        if (isImage) {
          const result = onOpen(item);

          const addImagePanel = (source: string) => {
            api.addPanel({
              component: 'image',
              id: item.path,
              params: { iconName: item.name, src: source },
              position,
              tabComponent: 'default',
              title,
            });
            log(`Image: ${item.path}`);
          };

          if (result === null) {
            return;
          }

          if (typeof result === 'string') {
            addImagePanel(result);
          } else {
            result
              .then((imageUrl) => {
                if (imageUrl) {
                  addImagePanel(imageUrl);
                }
              })
              .catch(() => undefined);
          }

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
          position,
          tabComponent: 'default',
          title,
        });

        const result = onOpen(item);
        if (result === null) {
          log(`Load returned null: ${item.path}`);
          return;
        }

        if (typeof result === 'string') {
          if (result.length > FILE_SIZE_WARN) {
            log(
              `Large file: ${item.path} (${Math.round(result.length / 1024)} KB)`
            );
          }

          added.api.updateParameters({ content: result, loading: undefined });
          log(`Loaded: ${item.path} (${result.length} chars)`);
        } else {
          const panelPath = item.path;

          result
            .then((fileContent) => {
              try {
                const panel = api.panels.find((p) => p.id === panelPath);

                if (!panel) {
                  return;
                }

                if (fileContent === null) {
                  panel.api.updateParameters({
                    content:
                      '// Failed to load file from repository. It might be empty, or you might be rate limited.',
                    loading: undefined,
                  });
                  log(`Load failed: ${panelPath}`);
                } else {
                  if (fileContent.length > FILE_SIZE_WARN) {
                    log(
                      `Large file: ${panelPath} (${Math.round(fileContent.length / 1024)} KB)`
                    );
                  }

                  panel.api.updateParameters({
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
                const panel = api.panels.find((p) => p.id === panelPath);

                if (panel) {
                  panel.api.updateParameters({
                    content: '// Error loading file.',
                    loading: undefined,
                  });
                }

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
      if (!api) {
        return;
      }

      const tabId = getTabId(tab);
      const existingPanel = api.panels.find((panel) => panel.id === tabId);

      if (existingPanel) {
        existingPanel.api.updateParameters({ content: tab.children });
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
            if (!api) {
              return;
            }

            let closedCount = 0;

            for (let i = api.panels.length - 1; i >= 0; i--) {
              if (!pinnedTabsRef.current.includes(api.panels[i].id)) {
                try {
                  api.panels[i].api.close();
                  closedCount++;
                } catch {
                  /* Ignore close error */
                }
              }
            }

            log(
              `Closed ${closedCount} tabs (${pinnedTabsRef.current.length} pinned kept)`
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
          const history = historyRef.current;
          if (history.index <= 0) {
            return;
          }

          history.index--;
          history.navigating = true;

          const panel = stateRef.current.api?.panels.find(
            (p) => p.id === history.entries[history.index]
          );

          if (panel) {
            panel.focus();
            log(`Back: ${panel.title ?? panel.id}`);
          }

          history.navigating = false;
        },
        ArrowRight: () => {
          const history = historyRef.current;
          if (history.index >= history.entries.length - 1) {
            return;
          }

          history.index++;
          history.navigating = true;

          const panel = stateRef.current.api?.panels.find(
            (p) => p.id === history.entries[history.index]
          );

          if (panel) {
            panel.focus();
            log(`Forward: ${panel.title ?? panel.id}`);
          }

          history.navigating = false;
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
      forwardedRef ?? ref ?? null,
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
          const panel = api.panels.find((p) => p.id === id);
          if (panel) {
            api.removePanel(panel);
          }
        }
      }
      for (const tab of tabs) {
        const tabId = getTabId(tab);
        if (stateRef.current.prevTabIds.has(tabId)) {
          api.panels
            .find((p) => p.id === tabId)
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
      if (!(api && files)) {
        return;
      }

      const timeoutId = setTimeout(() => {
        const activeIds = new Set(files.map((f) => virtualFileId(f.name)));

        for (const panel of api.panels) {
          if (panel.id.startsWith(VIRTUAL_PREFIX) && !activeIds.has(panel.id)) {
            try {
              api.removePanel(panel);
            } catch {
              /* Ignore removal error */
            }
          }
        }

        for (const file of files) {
          const id = virtualFileId(file.name);
          api.panels
            .find((p) => p.id === id)
            ?.api.updateParameters({ content: file.content });
        }
      }, 100);

      return () => clearTimeout(timeoutId);
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
        for (const file of filesRef.current) {
          if (file.open) {
            openVirtualFile(file);
            log(`Virtual file: ${file.name}`);
          }
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
            const first = event.api.panels.find(
              (p) => p.id === initialFiles[0]
            );
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
        event.api.onDidRemovePanel((removedPanel) => {
          stateRef.current.fileIds.delete(removedPanel.id);
          stateRef.current.onCloseMap.get(removedPanel.id)?.();
          stateRef.current.onCloseMap.delete(removedPanel.id);

          initMonaco()
            .then((monaco) => {
              const model = monaco.editor.getModel(
                monaco.Uri.parse(removedPanel.id)
              );
              if (model) {
                model.dispose();
              }
            })
            .catch(() => undefined);

          if (previewIdRef.current === removedPanel.id) {
            setPreviewId(null);
            previewIdRef.current = null;
          }

          if (!removedPanel.id.startsWith(VIRTUAL_PREFIX)) {
            setClosedTabs((prev) => [...prev.slice(-19), removedPanel.id]);
          }

          log(`Closed: ${removedPanel.title ?? removedPanel.id}`);
          notifyFiles();
        }),
        event.api.onDidAddPanel((addedPanel) => {
          log(`Opened tab: ${addedPanel.title ?? addedPanel.id}`);
          notifyFiles();
        }),
        event.api.onDidActivePanelChange(({ panel: activePanel }) => {
          if (activePanel?.id) {
            setActiveFileId(activePanel.id);
            onTabChangeRef.current?.(activePanel.id);

            if (!historyRef.current.navigating) {
              const history = historyRef.current;
              if (history.entries[history.index] !== activePanel.id) {
                history.entries = [
                  ...history.entries.slice(0, history.index + 1),
                  activePanel.id,
                ].slice(-50);
                history.index = history.entries.length - 1;
              }
            }

            log(`Focused: ${activePanel.title ?? activePanel.id}`);
          }
        })
      );
      stateRef.current.ready = true;
    };

    const mergedTree = useMemo(() => {
      if (!(tree || (files && files.length > 0))) {
        return tree;
      }

      const virtualFileToTreeItem = (file: VirtualFile): TreeDataItem => ({
        icon:
          file.icon ??
          (file.language ? resolveLanguageIcon(file.language) : undefined),
        id: virtualFileId(file.name),
        name: file.name,
        path: virtualFileId(file.name),
      });

      const topPinnedFiles =
        files
          ?.filter((file) => file.pin === 'top')
          .map(virtualFileToTreeItem) ?? [];
      const unpinnedFiles =
        files?.filter((file) => !file.pin).map(virtualFileToTreeItem) ?? [];
      const bottomPinnedFiles =
        files
          ?.filter((file) => file.pin === 'bottom')
          .map(virtualFileToTreeItem) ?? [];

      return [
        ...topPinnedFiles,
        ...unpinnedFiles,
        ...(tree ?? []),
        ...bottomPinnedFiles,
      ];
    }, [files, tree]);

    const sidebarChildren = useMemo(() => {
      const items: ReactNode[] = [];
      Children.forEach(children, (child) => {
        if (
          !(isValidElement(child) && (child.type as any)._type === TAB_TYPE)
        ) {
          items.push(child);
        }
      });
      return items;
    }, [children]);

    const sidebarContent = mergedTree ? (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-muted-foreground text-xs uppercase">
            explorer
          </span>
          <Button
            Icon={() =>
              treeCollapsed ? (
                <ChevronRight className="size-4 stroke-1" />
              ) : (
                <ChevronsDownUp className="size-4 stroke-1" />
              )
            }
            variant="hoverable"
            label="Close folders"
            onClick={() => {
              log(treeCollapsed ? 'Tree expanded all' : 'Tree collapsed all');
              setTreeCollapsed((prevCollapsed) => !prevCollapsed);
              setTreeKey((prevKey) => prevKey + 1);
            }}
            title={treeCollapsed ? 'Expand All' : 'Collapse All'}
            type="button"
            size="icon-sm"
          />
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
              if (!item) {
                return;
              }

              if (item.children) {
                log(`Folder: ${item.name}`);
                return;
              }

              if (item.id.startsWith(VIRTUAL_PREFIX)) {
                const virtualFile = files?.find(
                  (file) => virtualFileId(file.name) === item.id
                );

                if (virtualFile) {
                  openVirtualFile(virtualFile);
                }
              } else {
                openFile(item);
              }
            }}
            selectedId={activeFileId}
          />
        </div>
      </div>
    ) : (
      sidebarChildren
    );

    return (
      <Group
        orientation="horizontal"
        className={cn('bg-editor-background', props.className)}
      >
        {sidebarPosition === 'left' && (
          <Panel
            id="sidebar-left"
            collapsible
            collapsedSize={0}
            defaultSize={isSidebarCollapsed ? 0 : memorizedSidebarSize}
            minSize={10}
            onResize={handleSidebarResize}
            panelRef={sidebarPanelRef}
            className={cn(isSidebarCollapsed && '!hidden')}
          >
            <div
              ref={sidebarDivRef}
              className={cn(
                'h-full border-neutral/20 bg-muted',
                sidebarPosition === 'left' && 'border-r'
              )}
            >
              {sidebarContent}
            </div>
          </Panel>
        )}

        {sidebarPosition === 'left' && (
          <Separator
            className={cn(
              'w-1 cursor-col-resize transition-colors hover:bg-primary/20',
              isSidebarCollapsed && '!hidden'
            )}
          />
        )}

        <Panel
          id="main-content"
          minSize={20}
          className="flex h-full flex-col border-neutral/20 border-t"
        >
          <DockviewApiContext value={dockviewApi}>
            <DockviewReact
              className="dv-reset flex-1"
              components={COMPONENTS}
              onReady={handleReady}
              tabComponents={TAB_COMPONENTS}
              watermarkComponent={LazyWatermarkPanel}
            />
          </DockviewApiContext>
          <StatusBar />
        </Panel>

        {sidebarPosition === 'right' && (
          <Separator
            className={cn(
              'w-1 cursor-col-resize transition-colors hover:bg-primary/20',
              isSidebarCollapsed && '!hidden'
            )}
          />
        )}

        {sidebarPosition === 'right' && (
          <Panel
            id="sidebar-right"
            collapsible
            collapsedSize={0}
            defaultSize={isSidebarCollapsed ? 0 : memorizedSidebarSize}
            minSize={10}
            onResize={handleSidebarResize}
            panelRef={sidebarPanelRef}
            className={cn(isSidebarCollapsed && '!hidden')}
          >
            <div
              ref={sidebarDivRef}
              className={cn(
                'h-full border-neutral/20 bg-muted',
                sidebarPosition === 'right' && 'border-l'
              )}
            >
              {sidebarContent}
            </div>
          </Panel>
        )}

        <QuickOpenDialog
          log={log}
          onOpenFile={(item) => {
            if (item.id.startsWith(VIRTUAL_PREFIX)) {
              const virtualFile = files?.find(
                (file) => virtualFileId(file.name) === item.id
              );

              if (virtualFile) {
                openVirtualFile(virtualFile);
              }
            } else {
              openFile(item);
            }
          }}
          open={quickOpenVisible}
          tree={mergedTree ?? EMPTY_TREE}
        />
        <Toaster />
      </Group>
    );
  }
);

Workspace.displayName = 'Workspace';

export const IDE = Object.assign(
  forwardRef<WorkspaceRef, WorkspaceProps>((props, ref) => {
    if (typeof window === 'undefined') return null;
    return <Workspace ref={ref} {...props} />;
  }),
  {
    Folder: Panel,
    Tab,
    Tree: FileTree,
  }
);

export { Tab } from './ide/Tabs/Tab';
export { FileTree, Tree, TreeFile, TreeFolder } from './ide/Tree';
// Re-export everything for compatibility
export { FileIcon, FolderIcon, IconSvg } from './ide/Tree/TreeIcons';
export { getIconSvg, loadIconSvg } from './ide/utils';
export type { FileActions, TreeDataItem, VirtualFile, WorkspaceRef };
