import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import type * as React from "react";
import { Button, ButtonVariant } from "./button";
import { cn } from "./lib/utils";

export const Dialog = ({ ...props }: DialogPrimitive.Root.Props) => {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
};
export const DialogTrigger = ({ ...props }: DialogPrimitive.Trigger.Props) => {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
};
export const DialogPortal = ({ ...props }: DialogPrimitive.Portal.Props) => {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
};
export const DialogClose = ({ ...props }: DialogPrimitive.Close.Props) => {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
};
export const DialogOverlay = ({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) => {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "data-open:fade-in-0 data-closed:fade-out-0 fixed inset-0 isolate z-50 bg-black/10 duration-100 data-closed:animate-out data-open:animate-in supports-backdrop-filter:backdrop-blur-xs",
        className,
      )}
      {...props}
    />
  );
};
export const DialogContent = ({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
}) => {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-xl bg-popover p-6 text-popover-foreground text-sm outline-none ring-1 ring-foreground/10 duration-100 data-closed:animate-out data-open:animate-in sm:max-w-md",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant={ButtonVariant.GHOST}
                label="Close dialog"
                className="absolute top-4 right-4"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
};
export const DialogHeader = ({
  className,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
};
export const DialogFooter = ({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) => {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close
          render={<Button variant={ButtonVariant.OUTLINE} label="Close" />}
        >
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  );
};
export const DialogTitle = ({
  className,
  ...props
}: DialogPrimitive.Title.Props) => {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading font-medium leading-none", className)}
      {...props}
    />
  );
};
export const DialogDescription = ({
  className,
  ...props
}: DialogPrimitive.Description.Props) => {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-muted-foreground text-sm *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
};
