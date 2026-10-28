import { motion } from 'framer-motion';
import { useCountUp } from '../hooks/useCountUp.js';

const HEX = [
  '#6366f1', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6',
];

export default function DonutChart({ items, size = 230, stroke = 30 }) {
  const total = items.reduce((s, i) => s + i.votes, 0) || 1;
  const counted = useCountUp(total, { duration: 1200 });
  const R = (size - stroke) / 2 - 4;
  const C = 2 * Math.PI * R;

  let acc = 0;
  const segments = items.map((it, i) => {
    const frac = it.votes / total;
    const seg = {
      ...it,
      index: i,
      frac,
      rotation: acc * 360 - 90,
      dash: frac * C,
      delay: acc * 0.25,
    };
    acc += frac;
    return seg;
  });

  return (
    <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`translate(${size / 2}, ${size / 2})`}>
          <circle r={R} stroke="var(--surface-2)" strokeWidth={stroke} fill="none" />
          {segments.map((s) => (
            <motion.circle
              key={s.id}
              r={R}
              fill="none"
              stroke={HEX[s.index % HEX.length]}
              strokeWidth={stroke}
              strokeLinecap="round"
              transform={`rotate(${s.rotation})`}
              initial={{ strokeDasharray: `0 ${C}`, opacity: 0 }}
              animate={{
                strokeDasharray: `${Math.max(s.dash - 2, 0)} ${C}`,
                opacity: 1,
              }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: s.delay }}
            />
          ))}
          <text
            y={-8}
            textAnchor="middle"
            style={{ fill: 'var(--text)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30 }}
          >
            {Math.round(counted).toLocaleString()}
          </text>
          <text
            y={18}
            textAnchor="middle"
            style={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}
          >
            TOTAL VOTES
          </text>
        </g>
      </svg>
    </div>
  );
}
