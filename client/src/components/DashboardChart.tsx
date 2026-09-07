/**
 * Gráficas del dashboard aisladas en su propio chunk.
 *
 * Recharts pesa unos 400 KB, así que se carga solo cuando el usuario tiene
 * alguna gráfica visible en lugar de venir en el bundle de la página.
 */
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';

export type PieDatum = { name: string; value: number; color: string };
export type BarDatum = { name: string; count: number; fill?: string };

type Props =
  | { kind: 'category'; data: PieDatum[] }
  | { kind: 'status'; data: BarDatum[] }
  | { kind: 'location'; data: BarDatum[] };

export default function DashboardChart(props: Props) {
  if (props.kind === 'category') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={props.data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {props.data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const isLocation = props.kind === 'location';
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={props.data} layout="vertical" margin={{ left: isLocation ? 80 : 60 }}>
        <XAxis type="number" stroke="#64748B" tick={{ fontSize: 12 }} />
        <YAxis
          type="category"
          dataKey="name"
          stroke="#64748B"
          width={isLocation ? 80 : 60}
          tick={{ fontSize: isLocation ? 11 : 12 }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} {...(isLocation ? { fill: '#F59E0B' } : {})} />
      </BarChart>
    </ResponsiveContainer>
  );
}
