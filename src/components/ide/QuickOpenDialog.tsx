import { Command as Cmdk } from 'cmdk';
import { useSetAtom } from 'jotai';
import { Search } from 'lucide-react';
import { useMemo } from 'react';
import { Dialog, DialogContent } from '../dialog';
import { quickOpenAtom } from './atoms';
import { ICON_CLASS } from './constants';
import { FileIcon } from './Tree/TreeIcons';
import type { TreeDataItem } from './types';
import { flattenTree } from './utils';

export const QuickOpenDialog = ({
  log: logFn,
  onOpenFile,
  open,
  tree,
}: {
  log: (msg: string) => void;
  onOpenFile: (item: TreeDataItem) => void;
  open: boolean;
  tree: TreeDataItem[];
}) => {
  const setOpen = useSetAtom(quickOpenAtom);
  const flatFiles = useMemo(() => flattenTree(tree), [tree]);

  const onChange = (v: boolean) => {
    setOpen(v);
    if (!v) logFn('Quick open closed');
  };

  return (
    <Dialog onOpenChange={onChange} open={open}>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <Cmdk className="flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:size-5">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 size-4 shrink-0 opacity-50" />
            <Cmdk.Input
              className="flex h-10 w-full bg-transparent py-3 text-xs outline-hidden placeholder:text-muted-foreground"
              placeholder="Search files..."
            />
          </div>
          <Cmdk.List className="max-h-[300px] overflow-y-auto overflow-x-hidden">
            <Cmdk.Empty className="py-6 text-center text-xs">
              No files found
            </Cmdk.Empty>
            {flatFiles.map((f) => {
              const parent = f.path.includes('/')
                ? f.path.slice(0, f.path.lastIndexOf('/'))
                : '';
              return (
                <Cmdk.Item
                  className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-hidden data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
                  key={f.id}
                  onSelect={() => {
                    logFn(`Quick open: ${f.name}`);
                    onOpenFile(f);
                    setOpen(false);
                  }}
                  value={`${f.name} ${f.path}`}
                >
                  <FileIcon className={ICON_CLASS} name={f.name} />
                  <span className="shrink-0 truncate">{f.name}</span>
                  {parent ? (
                    <span className="min-w-0 truncate text-muted-foreground text-xs">
                      {parent}
                    </span>
                  ) : null}
                </Cmdk.Item>
              );
            })}
          </Cmdk.List>
        </Cmdk>
      </DialogContent>
    </Dialog>
  );
};
