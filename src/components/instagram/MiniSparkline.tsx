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

  // Determine trend color
  const isUp = data[data.length - 1] >= data[0];
  const strokeColor = color || (isUp ? "hsl(var(--chart-2))" : "hsl(var(--destructive))");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
