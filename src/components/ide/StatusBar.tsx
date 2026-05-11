import { useAtomValue } from 'jotai';
import { activeFileInfoAtom, cursorAtom } from './atoms';

export const StatusBar = () => {
  const cursor = useAtomValue(cursorAtom);
  const fileInfo = useAtomValue(activeFileInfoAtom);
  return (
    <div className="flex h-6 items-center justify-between border-border border-t px-3 text-muted-foreground text-xs">
      <span className="truncate">{fileInfo.path}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono">
          Ln {cursor.line}, Col {cursor.col}
        </span>
        <span className="capitalize">{fileInfo.language}</span>
      </div>
    </div>
  );
};
