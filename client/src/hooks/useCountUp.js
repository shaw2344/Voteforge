import { useEffect, useRef, useState } from 'react';

function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function useCountUp(target, { duration = 1400, decimals = 0, delay = 0 } = {}) {
  const [value, setValue] = useState(0);
  const frame = useRef(null);
  const startRef = useRef(null);
  const targetRef = useRef(target);

  useEffect(() => {
    targetRef.current = target;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setValue(target);
      return;
    }

    const step = (ts) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      if (elapsed < delay) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      const t = Math.min((elapsed - delay) / duration, 1);
      setValue(targetRef.current * easeOutExpo(t));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame.current);
      startRef.current = null;
    };
  }, [target, duration, delay]);

  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
