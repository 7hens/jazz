import type { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors', {
  variants: {
    variant: {
      default: 'bg-surface-2 text-ink-2',
      secondary: 'bg-emerald-tint text-emerald',
      purple: 'bg-violet-tint text-violet',
      orange: 'bg-orange-tint text-orange',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  className?: string
  children: ReactNode
}

function Badge({ className, variant, children }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>
}

export { Badge, badgeVariants }
