import { useCountUp } from '../hooks/useCountUp.js';

export default function AnimatedNumber({ value, decimals = 0, suffix = '', duration = 1400, delay = 0 }) {
  const v = useCountUp(value, { duration, decimals, delay });
  return (
    <span>
      {v.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
