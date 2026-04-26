import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ComponentProps } from 'react';

import { cn } from './lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'h-9 px-4 py-2',
        'icon-sm': 'h-8 w-8 p-0',
        icon: 'h-9 w-9 p-0',
        sm: 'h-8 rounded-md px-3',
      },
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        outline:
          'border border-border bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
      },
    },
  }
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { variant?: 'default' | 'ghost' | 'outline' };

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size, variant, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ className, size, variant }))}
      type={props.type ?? 'button'}
      {...props}
    />
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };
