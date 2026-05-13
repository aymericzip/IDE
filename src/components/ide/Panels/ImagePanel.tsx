import type { IDockviewPanelProps } from "dockview-react";
import { useEffect, useState } from "react";
import { Loader } from "../../loader";
import { cn } from "../../lib/utils";
import { CENTER } from "../constants";

export const ImagePanel = ({
  api,
  params,
}: IDockviewPanelProps<{ src: string }>) => {
  const [src, setSrc] = useState(params.src);

  useEffect(() => {
    const disposable = api.onDidParametersChange((event) => {
      const parameters = event as { src?: string };

      if (parameters.src !== undefined) {
        setSrc(parameters.src);
      }
    });

    return () => disposable.dispose();
  }, [api]);

  if (!src) {
    return <Loader />;
  }

  return (
    <div className={cn(CENTER, "h-full overflow-auto p-4")}>
      <img
        alt={api.title ?? ""}
        className="max-h-full max-w-full object-contain"
        src={src}
      />
    </div>
  );
};
