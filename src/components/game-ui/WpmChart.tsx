import { memo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { WpmHistoryPoint } from '@/utils/scoring';

interface WpmChartProps {
  data: WpmHistoryPoint[];
  className?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string; color: string }[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      <div className="mb-1 font-semibold text-foreground">
        {label}s
      </div>
      {payload.map((p) => (
        <div
          key={p.dataKey}
          className="flex items-center gap-2"
          style={{ color: p.color }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-muted-foreground">{p.dataKey}:</span>
          <span className="font-mono font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export const WpmChart = memo(function WpmChart({ data, className }: WpmChartProps) {
  if (!data.length) return null;

  const maxWpm = Math.max(...data.map((d) => Math.max(d.wpm, d.raw)), 10);
  const maxErrors = Math.max(...data.map((d) => d.errors), 1);

  // Normalize errors to fit on the WPM scale (right axis visual)
  const chartData = data.map((d) => ({
    ...d,
    errorsScaled: (d.errors / maxErrors) * maxWpm * 0.3,
  }));

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            opacity={0.3}
          />
          <XAxis
            dataKey="second"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            domain={[0, Math.ceil(maxWpm / 20) * 20]}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={32}
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}
          />
          <Line
            type="monotone"
            dataKey="wpm"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
          />
          <Line
            type="monotone"
            dataKey="raw"
            name="raw"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1.75}
            strokeDasharray="2 4"
            dot={false}
            opacity={0.8}
            activeDot={{ r: 3, fill: 'hsl(var(--muted-foreground))' }}
          />
          <Line
            type="stepAfter"
            dataKey="errors"
            stroke="hsl(var(--destructive, 0 84% 60%))"
            strokeWidth={1}
            dot={false}
            opacity={0.6}
            activeDot={{ r: 3, fill: 'hsl(var(--destructive, 0 84% 60%))' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});
