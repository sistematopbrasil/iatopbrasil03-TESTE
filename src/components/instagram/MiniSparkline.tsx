interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function MiniSparkline({ data, width = 80, height = 30, color }: Props) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  
  // Area fill path
  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  const isUp = data[data.length - 1] >= data[0];
  const strokeColor = color || (isUp ? "hsl(var(--chart-2))" : "hsl(var(--destructive))");
  const gradientId = `sparkline-gradient-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Dot at end */}
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={2} fill={strokeColor} />
    </svg>
  );
}
