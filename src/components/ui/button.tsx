import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-button transition-colors duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/60 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 dark:focus-visible:ring-white/60',
  {
    variants: {
      variant: {
        // Главное действие — кобальтовый блок (единственный кобальт на экране).
        primary:
          'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800',
        // Uber-чёрный блок; в тёмной теме инвертируется в белый.
        dark: 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100',
        // Серые заливки без рамок.
        secondary:
          'bg-gray-100 text-navy hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15',
        ghost:
          'text-gray-600 hover:bg-gray-100 hover:text-navy dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white',
        link: 'text-primary-600 underline-offset-4 hover:underline dark:text-primary-400',
      },
      size: {
        sm: 'h-10 px-4',
        md: 'h-12 px-5',
        lg: 'h-12 px-6',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
