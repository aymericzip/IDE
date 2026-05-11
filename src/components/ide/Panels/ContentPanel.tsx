import type { IDockviewPanelProps } from 'dockview-react';
import { type ReactNode, useEffect, useState } from 'react';

export const ContentPanel = ({
  api,
  params,
}: IDockviewPanelProps<{ content: ReactNode }>) => {
  const [content, setContent] = useState(params.content);
  useEffect(() => {
    const d = api.onDidParametersChange((e) => {
      const p = e as { content?: ReactNode };
      if (p.content !== undefined) setContent(p.content);
    });
    return () => d.dispose();
  }, [api]);
  return <div className="h-full overflow-auto">{content}</div>;
};
