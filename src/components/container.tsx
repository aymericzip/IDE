import { cva, type VariantProps } from "class-variance-authority";
import type {
  DetailedHTMLProps,
  FC,
  HTMLAttributes,
  PropsWithChildren,
} from "react";
import { cn } from "./lib/utils";

/**
 * Container component variants using class-variance-authority
 * Provides flexible styling options for background, padding, borders, and layout
 */
export const containerVariants = cva("flex flex-col text-text backdrop-blur", {
  variants: {
    roundedSize: {
      none: "rounded-none",
      sm: "rounded-sm [corner-shape:squircle] supports-[corner-shape:squircle]:rounded-md",
      md: "rounded-md [corner-shape:squircle] supports-[corner-shape:squircle]:rounded-lg",
      lg: "rounded-lg [corner-shape:squircle] supports-[corner-shape:squircle]:rounded-xl",
      xl: "rounded-xl [corner-shape:squircle] supports-[corner-shape:squircle]:rounded-2xl",
      "2xl":
        "rounded-2xl [corner-shape:squircle] supports-[corner-shape:squircle]:rounded-3xl",
      "3xl":
        "rounded-3xl [corner-shape:squircle] supports-[corner-shape:squircle]:rounded-4xl",
      "4xl":
        "rounded-4xl [corner-shape:squircle] supports-[corner-shape:squircle]:rounded-[2.5rem]",
      full: "rounded-full",
    },
    transparency: {
      none: "bg-card",
      xs: "bg-card/95",
      sm: "bg-card/90",
      md: "bg-card/70",
      lg: "bg-card/40",
      xl: "bg-card/20",
      full: "",
    },
    padding: {
      none: "p-0",
      sm: "px-3 py-2",
      md: "px-4 py-3",
      lg: "px-6 py-4",
      xl: "px-8 py-6",
      "2xl": "px-10 py-8",
    },
    separator: {
      without: "",
      x: "divide-x divide-dashed divide-text/20",
      y: "divide-y divide-dashed divide-text/20",
      both: "divide-x divide-y divide-dashed divide-text/20",
    },
    border: {
      none: "",
      with: "border-[1.3px]",
    },
    borderColor: {
      primary: "border-primary",
      secondary: "border-secondary",
      neutral: "border-neutral",
      card: "border-card",
      text: "border-text",
      error: "border-error",
      warning: "border-warning",
      success: "border-success",
    },
    background: {
      none: "",
      hoverable:
        "bg-opacity-5! backdrop-blur-0 hover:bg-opacity-10! hover:backdrop-blur focus:bg-opacity-10! focus:backdrop-blur aria-selected:bg-opacity-15! aria-selected:backdrop-blur",
      with: "",
    },
    gap: {
      none: "gap-0",
      sm: "gap-1",
      md: "gap-3",
      lg: "gap-5",
      xl: "gap-8",
      "2xl": "gap-10",
    },
  },
  defaultVariants: {
    roundedSize: "lg",
    border: "none",
    borderColor: "text",
    transparency: "md",
    padding: "none",
    separator: "without",
    gap: "none",
  },
  compoundVariants: [
    {
      background: "none",
      class: "bg-transparent",
    },
  ],
});

/** Available rounded corner sizes for the container */
export const ContainerRoundedSize = {
  NONE: "none",
  SM: "sm",
  MD: "md",
  LG: "lg",
  XL: "xl",
  "2xl": "2xl",
  "3xl": "3xl",
  "4xl": "4xl",
  "5xl": "5xl",
  FULL: "full",
} as const;

export type ContainerRoundedSize =
  (typeof ContainerRoundedSize)[keyof typeof ContainerRoundedSize];

/** Background transparency levels for the container */
export const ContainerTransparency = {
  NONE: "none",
  SM: "sm",
  MD: "md",
  LG: "lg",
  XL: "xl",
  FULL: "full",
} as const;

export type ContainerTransparency =
  (typeof ContainerTransparency)[keyof typeof ContainerTransparency];

/** Padding sizes for container content */
export const ContainerPadding = {
  NONE: "none",
  SM: "sm",
  MD: "md",
  LG: "lg",
  XL: "xl",
} as const;

export type ContainerPadding =
  (typeof ContainerPadding)[keyof typeof ContainerPadding];

/** Separator options for dividing container children */
export const ContainerSeparator = {
  WITHOUT: "without",
  X: "x",
  Y: "y",
  BOTH: "both",
} as const;

export type ContainerSeparator =
  (typeof ContainerSeparator)[keyof typeof ContainerSeparator];

/** Border color options for the container */
export const ContainerBorderColor = {
  PRIMARY: "primary",
  SECONDARY: "secondary",
  NEUTRAL: "neutral",
  CARD: "card",
  TEXT: "text",
  ERROR: "error",
  WARNING: "warning",
  SUCCESS: "success",
} as const;

export type ContainerBorderColor =
  (typeof ContainerBorderColor)[keyof typeof ContainerBorderColor];

/** Background interaction states for the container */
export const ContainerBackground = {
  NONE: "none",
  HOVERABLE: "hoverable",
  WITH: "with",
} as const;

export type ContainerBackground =
  (typeof ContainerBackground)[keyof typeof ContainerBackground];

/** Gap sizes between container children */
export const ContainerGap = {
  NONE: "none",
  SM: "sm",
  MD: "md",
  LG: "lg",
  XL: "xl",
  "2xl": "2xl",
} as const;

export type ContainerGap = (typeof ContainerGap)[keyof typeof ContainerGap];

/** Container component props extending HTML div attributes */
export type ContainerProps = PropsWithChildren<
  Omit<VariantProps<typeof containerVariants>, "border">
> &
  DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
    /** Whether to show a border around the container */
    border?: boolean;
  };

/**
 * Container Component
 *
 * A flexible container component for organizing content with customizable styling options.
 * Supports various visual states, layouts, and accessibility features.
 *
 * ## Features
 * - **Flexible Layout**: Supports different padding, gap, and separator options
 * - **Visual Variants**: Multiple background transparency levels and border styles
 * - **Responsive Design**: Configurable rounded corners and spacing
 * - **Semantic HTML**: Proper div element with extensible attributes
 *
 * ## Accessibility
 * - Inherits all standard div accessibility features
 * - Supports ARIA attributes through spread props
 * - Maintains proper semantic structure for screen readers
 *
 * @param children - The content to display inside the container
 * @param roundedSize - Border radius size (default: 'md')
 * @param transparency - Background transparency level (default: 'md')
 * @param padding - Internal padding size (default: 'none')
 * @param separator - Divider lines between children (default: 'without')
 * @param border - Whether to show border (default: false)
 * @param borderColor - Color of the border (default: 'text')
 * @param background - Background interaction behavior (default: 'none')
 * @param gap - Space between child elements (default: 'none')
 * @param className - Additional CSS classes
 * @param props - Additional HTML div attributes including ARIA attributes
 */
export const Container: FC<ContainerProps> = ({
  children,
  roundedSize,
  padding,
  transparency,
  separator,
  className,
  border,
  borderColor,
  background,
  gap,
  ...props
}) => (
  <div
    className={cn(
      containerVariants({
        roundedSize,
        transparency,
        padding,
        separator,
        border:
          typeof border === "boolean" ? (border ? "with" : "none") : undefined,
        background,
        borderColor,
        gap,
      }),
      className,
    )}
    {...props}
  >
    {children}
  </div>
);
