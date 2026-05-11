import { cn } from "../../lib/utils";
import { CENTER } from "../constants";

export const WatermarkPanel = () => (
  <div className={cn(CENTER, "text-muted-foreground/30 text-xs")}>
    Open a file
  </div>
);
