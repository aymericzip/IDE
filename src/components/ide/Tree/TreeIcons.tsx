import { type ComponentProps, useEffect, useState } from 'react';
import {
  getIconManifest,
  getSvg,
  iconsReady,
  loadIconSvg,
  resolveFileIcon,
  resolveFolderIcon,
} from '../utils';

export const useIconsReady = () => {
  const [loaded, setLoaded] = useState(() => getIconManifest() !== null);
  useEffect(() => {
    if (loaded) return;
    iconsReady.then(() => setLoaded(true)).catch(() => undefined);
  }, [loaded]);
  return loaded;
};

/** Markup for `iconName`, fetched on first use and cached across components. */
const useIconSvg = (iconName: string) => {
  // Only used to re-render once a fetch has filled the shared icon cache.
  const [, setLoadedIcon] = useState('');
  const svg = iconName ? getSvg(iconName) : '';

  useEffect(() => {
    if (!iconName || getSvg(iconName)) return;

    let isAlive = true;
    void loadIconSvg(iconName).then(() => {
      if (isAlive) setLoadedIcon(iconName);
    });

    return () => {
      isAlive = false;
    };
  }, [iconName]);

  return svg;
};

export const IconSvg = ({
  iconName,
  ...props
}: ComponentProps<'span'> & { iconName: string }) => {
  const svg = useIconSvg(iconName);
  return <span dangerouslySetInnerHTML={{ __html: svg }} {...props} />;
};

export const FileIcon = ({
  name,
  ...props
}: ComponentProps<'span'> & { name: string }) => {
  const ready = useIconsReady();
  return <IconSvg iconName={ready ? resolveFileIcon(name) : ''} {...props} />;
};

export const FolderIcon = ({
  name,
  open,
  ...props
}: ComponentProps<'span'> & { name: string; open?: boolean }) => {
  const ready = useIconsReady();
  return (
    <IconSvg
      iconName={ready ? resolveFolderIcon(name, open ?? false) : ''}
      {...props}
    />
  );
};
