import type { ComponentPropsWithRef, ComponentType, Ref } from 'react';

/**
 * The element a base-ui part renders, read off the `RefObject` member of its
 * `Props["ref"]` — the one member base-ui's event-handler rewrite leaves alone.
 */
type RefElementOf<TProps> = 'ref' extends keyof TProps
  ? Extract<TProps['ref'], { current: unknown }> extends {
      current: infer TElement;
    }
    ? NonNullable<TElement>
    : never
  : never;

/**
 * base-ui builds every part's props by mapping each function-typed prop to a
 * handler taking a `BaseUIEvent`. Under preact 11's typings that mapping also
 * catches the `ref` callback, turning `Props["ref"]` into a union containing
 * `(event: never) => …` and `(event: BaseUIEvent<…>) => …`. Neither is a valid
 * `RefCallback`, so spreading such props back into the component fails. The
 * component itself accepts a plain `Ref<Element>`; re-point `ref` at that.
 */
export type BaseUIProps<TProps> = Omit<TProps, 'ref'> & {
  ref?: Ref<RefElementOf<TProps>> | undefined;
};

/**
 * Button-like parts annotate `Props["ref"]` with the concrete element they
 * render (`Ref<HTMLButtonElement>`), while the component itself accepts the
 * widened `Ref<HTMLElement>`. preact's `RefCallback` is contravariant, so the
 * narrower ref does not fit; take `ref` from what the component accepts.
 */
export type WithRefOf<TComponent extends ComponentType<any>, TProps> = Omit<
  TProps,
  'ref'
> &
  Pick<ComponentPropsWithRef<TComponent>, 'ref'>;
