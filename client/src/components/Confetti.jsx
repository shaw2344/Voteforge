import confetti from 'canvas-confetti';

export function fireVoteConfetti() {
  const colors = ['#6366f1', '#8b5cf6', '#22d3ee', '#d946ef', '#10b981'];

  const defaults = { spread: 360, ticks: 90, gravity: 0.9, decay: 0.93, startVelocity: 32, colors };

  const burst = (ratio) => {
    confetti({ ...defaults, particleCount: 45, scalar: 1.1, origin: { x: ratio, y: 0.7 } });
  };

  burst(0.5);

  window.setTimeout(() => burst(0.25), 180);
  window.setTimeout(() => burst(0.75), 320);
  window.setTimeout(() => {
    confetti({ ...defaults, particleCount: 70, scalar: 0.9, shapes: ['circle'], origin: { x: 0.5, y: 0.35 } });
  }, 520);
}
