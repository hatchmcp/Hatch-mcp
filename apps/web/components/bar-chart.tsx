'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export interface BarChartBucket {
  ts: Date
  value: number
  errorValue?: number
}

export function BarChart({
  buckets,
  height = 200,
  className,
  formatLabel,
}: {
  buckets: BarChartBucket[]
  height?: number
  className?: string
  formatLabel?: (ts: Date) => string
}) {
  const maxValue = useMemo(() => {
    let max = 1
    for (const b of buckets) max = Math.max(max, b.value)
    return max
  }, [buckets])

  const [hover, setHover] = useState<number | null>(null)

  // Reserve a bit of top space so the tallest bar doesn't kiss the edge
  const PAD_TOP = 8
  const PAD_BOTTOM = 18 // for the bottom axis labels
  const plotHeight = height - PAD_TOP - PAD_BOTTOM

  if (buckets.length === 0) {
    return (
      <div
        className={cn(
          'border border-border rounded-md bg-surface flex items-center justify-center text-xs text-text-tertiary font-mono',
          className
        )}
        style={{ height }}
      >
        no data
      </div>
    )
  }

  // SVG uses a 0..1000 viewBox horizontally — bars scale via percent widths.
  // We compute coordinates per bar in viewBox units.
  const W = 1000
  const gap = buckets.length > 60 ? 0.3 : buckets.length > 30 ? 0.5 : 1
  const barWidth = (W - gap * (buckets.length - 1)) / buckets.length

  return (
    <div className={cn('relative border border-border rounded-md bg-surface', className)}>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Horizontal gridlines (25/50/75/100%) */}
        {[0.25, 0.5, 0.75].map((p) => {
          const y = PAD_TOP + plotHeight * (1 - p)
          return (
            <line
              key={p}
              x1={0}
              x2={W}
              y1={y}
              y2={y}
              stroke="var(--border-color)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}

        {/* Bars */}
        {buckets.map((b, i) => {
          const x = i * (barWidth + gap)
          const totalH = (b.value / maxValue) * plotHeight
          const errH = b.errorValue ? (b.errorValue / maxValue) * plotHeight : 0
          const y = PAD_TOP + plotHeight - totalH
          const isHover = hover === i

          return (
            <g
              key={i}
              onMouseEnter={() => setHover(i)}
              onPointerDown={() => setHover(i)}
            >
              {/* Hit zone — covers the bar's column for easy hover */}
              <rect
                x={x}
                y={PAD_TOP}
                width={barWidth + gap}
                height={plotHeight}
                fill="transparent"
              />
              {/* Total bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={totalH}
                fill={isHover ? 'var(--accent)' : 'var(--surface-3)'}
              />
              {/* Errors on top */}
              {errH > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={errH}
                  fill="var(--error)"
                  opacity={0.7}
                />
              )}
            </g>
          )
        })}
      </svg>

      {/* Hover tooltip — positioned in pixel space using the hover index */}
      {hover != null && buckets[hover] && (
        <div
          className="absolute top-2 right-2 px-2.5 py-1.5 border border-border-strong rounded-sm bg-surface-3 text-[11px] font-mono tabular-nums"
          aria-hidden
        >
          <div className="text-text-tertiary mb-0.5">
            {formatLabel ? formatLabel(buckets[hover].ts) : format(buckets[hover].ts, 'PPp')}
          </div>
          <div className="text-text-primary">
            {buckets[hover].value} call{buckets[hover].value === 1 ? '' : 's'}
            {buckets[hover].errorValue ? (
              <span className="text-error ml-2">{buckets[hover].errorValue} err</span>
            ) : null}
          </div>
        </div>
      )}

      {/* X-axis labels (first + last) */}
      <div className="flex justify-between px-3 pb-2 -mt-4 text-[10px] font-mono text-text-tertiary">
        <span>{format(buckets[0].ts, 'MMM d HH:mm')}</span>
        <span>{format(buckets[buckets.length - 1].ts, 'MMM d HH:mm')}</span>
      </div>
    </div>
  )
}
