type ChartTooltipProps = {
  active?: boolean
  label?: string | number
  payload?: Array<{ name?: string; value?: number | string; color?: string }>
}

export function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-hairline bg-surface px-3 py-2 text-sm shadow-pop">
      <div className="text-xs font-medium text-ink-3">{label}</div>
      <div className="mt-1.5 space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-ink-2">{entry.name}</span>
            <span className="ml-auto pl-3 font-semibold tabular-nums text-ink">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
