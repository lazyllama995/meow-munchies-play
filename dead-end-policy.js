// Only a proved impossible order ends play; a timeout is never a defeat.
export function deadEndAction({ status, won }) {
  return !won && status === 'dead' ? 'terminal' : 'continue';
}
