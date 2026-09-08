// Bridges two gaps between `preact/compat`'s React type surface and what
// React-typed dependencies expect of it.
import type { JSX as PreactJSX } from 'preact';

declare module 'react' {
  // `@base-ui/react` gates its "wrap every event handler in a BaseUIEvent"
  // mapped type on `React.SyntheticEvent`, which compat does not declare. It
  // then resolves to `any`, the gate matches every function-shaped prop, and
  // `ref` gets rewritten into an event handler.
  type SyntheticEvent<T = Element, E = Event> = PreactJSX.TargetedEvent<
    T extends EventTarget ? T : EventTarget,
    E
  >;

  // React's SVG attribute set is a superset of preact's. Icon packs `Pick`
  // these names off `React.SVGProps`, and picking a key the interface does not
  // declare yields a *required* prop rather than an optional one. This has to
  // stay an `interface` so that it merges into compat's own declaration.
  // biome-ignore lint/style/useConsistentTypeDefinitions: declaration merging
  interface SVGProps<T extends EventTarget> {
    autoReverse?: number | string;
    color?: string;
    crossOrigin?: string;
    fr?: number | string;
    max?: number | string;
    media?: string;
    method?: string;
    min?: number | string;
    name?: string;
    onDoubleClick?: PreactJSX.MouseEventHandler<T>;
    onDoubleClickCapture?: PreactJSX.MouseEventHandler<T>;
    path?: string;
    target?: string;
    widths?: number | string;
  }
}
