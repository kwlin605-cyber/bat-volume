import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium cursor-pointer transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-controlHint)] focus-visible:ring-offset-2 [&_svg]:size-4 [&_svg]:shrink-0',
  { variants: {
    variant: { default: 'bg-[var(--ui-controlStrong)] text-[color:var(--color-white)] hover:bg-[var(--ui-buttonHover)]', outline: 'border border-[var(--ui-controlBorder)] bg-[var(--color-white)] text-[color:var(--ui-controlText)] hover:bg-[var(--ui-controlHover)]', ghost: 'text-[color:var(--ui-controlMuted)] hover:bg-[var(--ui-controlHover)] hover:text-[color:var(--ui-controlStrong)]' },
    size: { default: 'h-11 px-5', sm: 'h-10 px-4', icon: 'size-11' },
  }, defaultVariants: { variant: 'default', size: 'default' } },
)

type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }
export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button'
  return <Component data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
