import { type ComponentProps, useEffect, useState } from 'react';
import {
  getSvg,
  iconsReady,
  resolveFileIcon,
  resolveFolderIcon,
} from '../utils';

export const useIconsReady = () => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    iconsReady.then(() => setLoaded(true)).catch(() => undefined);
  }, []);
  return loaded;
};

export const FileIcon = ({
  name,
  ...props
}: ComponentProps<'span'> & { name: string }) => {
  useIconsReady();
  return (
    <span
      dangerouslySetInnerHTML={{ __html: getSvg(resolveFileIcon(name)) }}
      {...props}
    />
  );
};

export const FolderIcon = ({
  name,
  open,
  ...props
}: ComponentProps<'span'> & { name: string; open?: boolean }) => {
  useIconsReady();
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: getSvg(resolveFolderIcon(name, open ?? false)),
      }}
      {...props}
    />
  );
};
