import type { IDockviewPanelProps } from "dockview-react";
import { type ReactNode, useEffect, useState } from "react";

export const ContentPanel = ({
  api,
  params,
}: IDockviewPanelProps<{ content: ReactNode }>) => {
  const [content, setContent] = useState(params.content);

  useEffect(() => {
    const disposable = api.onDidParametersChange((event) => {
      const parameters = event as { content?: ReactNode };

      if (parameters.content !== undefined) {
        setContent(parameters.content);
      }
    });

    return () => disposable.dispose();
  }, [api]);

  return <div className="h-full overflow-auto">{content}</div>;
};
