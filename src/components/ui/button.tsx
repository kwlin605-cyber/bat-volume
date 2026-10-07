import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium cursor-pointer transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 [&_svg]:size-4 [&_svg]:shrink-0',
  { variants: {
    variant: { default: 'bg-zinc-900 text-white hover:bg-zinc-800', outline: 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50', ghost: 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900' },
    size: { default: 'h-11 px-5', sm: 'h-10 px-4', icon: 'size-11' },
  }, defaultVariants: { variant: 'default', size: 'default' } },
)

type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }
export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button'
  return <Component data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
