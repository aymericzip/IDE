import type { ComponentPropsWithRef, ComponentType } from 'react';

/**
 * base-ui annotates a part's `Props["ref"]` with the concrete element it
 * renders (`Ref<HTMLButtonElement>`), while the component itself accepts the
 * widened `Ref<HTMLElement>`. React's `RefCallback` is bivariant on purpose,
 * so the two line up under `@types/react`; preact's is a plain function type
 * and therefore contravariant, so spreading such props back into the component
 * fails. Re-point `ref` at what the component actually accepts.
 */
export type WithRefOf<TComponent extends ComponentType<any>, TProps> = Omit<
  TProps,
  'ref'
> &
  Pick<ComponentPropsWithRef<TComponent>, 'ref'>;
