'use client'

import { useId } from 'react'

interface SparkProps {
  data: number[]
  color?: string
  width?: number
  height?: number
  fill?: boolean
}

export function Spark({ data, color, width = 200, height = 60, fill = false }: SparkProps) {
  const stroke = color || 'var(--accent-a)'
  const rawId = useId().replace(/:/g, '')
  const gid = `vspk-${rawId}`
  const min = Math.min(...data)
  const max = Math.max(...data)
  const padX = 2
  const padY = 4
  const xs = data.map((_, i) => padX + (i * (width - padX * 2)) / (data.length - 1))
  const ys = data.map((v) => height - padY - ((v - min) / (max - min || 1)) * (height - padY * 2))
  let p = `M ${xs[0]} ${ys[0]}`
  for (let i = 1; i < xs.length; i++) {
    const cx = (xs[i - 1] + xs[i]) / 2
    p += ` C ${cx} ${ys[i - 1]}, ${cx} ${ys[i]}, ${xs[i]} ${ys[i]}`
  }
  const area = `${p} L ${xs[xs.length - 1]} ${height} L ${xs[0]} ${height} Z`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height, display: 'block', overflow: 'visible' }}>
      {fill && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} />
        </>
      )}
      <path d={p} stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}
