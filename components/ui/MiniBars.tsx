interface MiniBarsProps {
  data: number[]
  color?: string
  width?: number
  height?: number
}

export function MiniBars({ data, color, width = 120, height = 40 }: MiniBarsProps) {
  const fill = color || 'var(--accent-a)'
  const max = Math.max(...data)
  const bw = (width - (data.length - 1) * 3) / data.length
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height, display: 'block' }}>
      {data.map((v, i) => {
        const h = (v / max) * (height - 4)
        return (
          <rect
            key={i}
            x={i * (bw + 3)}
            y={height - h}
            width={bw}
            height={h}
            rx="2"
            fill={fill}
            opacity={i === data.length - 1 ? 1 : 0.4}
          />
        )
      })}
    </svg>
  )
}
