import type { MovementPattern } from '../data';

const PATHS: Record<MovementPattern, string> = {
  push: 'M4 12h12M12 6l6 6-6 6',
  pull: 'M20 12H8M12 6l-6 6 6 6',
  legs: 'M8 4v8l-3 8M16 4v8l3 8',
  core: 'M6 6h12v12H6z',
  skill: 'M12 3l2.5 6 6.5.5-5 4.2 1.6 6.3L12 16.5 6.4 20l1.6-6.3-5-4.2 6.5-.5z',
  none: 'M12 5v14M5 12h14',
};

export function PatternIcon({ pattern }: { pattern: MovementPattern }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[pattern]} />
    </svg>
  );
}
