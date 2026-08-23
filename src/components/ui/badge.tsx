import type { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-slate-200 bg-slate-100 text-slate-700',
        secondary: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        purple: 'border-violet-200 bg-violet-50 text-violet-700',
        orange: 'border-orange-200 bg-orange-50 text-orange-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  className?: string
  children: ReactNode
}

function Badge({ className, variant, children }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>
}

export { Badge, badgeVariants }
