import type { IDockviewPanelProps } from 'dockview-react';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { CENTER } from '../constants';

export const ImagePanel = ({
  api,
  params,
}: IDockviewPanelProps<{ src: string }>) => {
  const [src, setSrc] = useState(params.src);
  useEffect(() => {
    const d = api.onDidParametersChange((e) => {
      const p = e as { src?: string };
      if (p.src !== undefined) setSrc(p.src);
    });
    return () => d.dispose();
  }, [api]);

  if (!src)
    return (
      <div className={cn(CENTER, 'text-muted-foreground text-xs')}>
        Loading...
      </div>
    );

  return (
    <div className={cn(CENTER, 'h-full overflow-auto p-4')}>
      <img
        alt={api.title ?? ''}
        className="max-h-full max-w-full object-contain"
        src={src}
      />
    </div>
  );
};
