/** 線のアイコン（絵文字の代わり）。色は文字色に合わせる */
const PATHS = {
  close: 'M5 5l10 10M15 5L5 15',
  soundOn: 'M3 8h3l4-3v10l-4-3H3zM13.5 7.5a3.5 3.5 0 010 5M15.5 5.5a6.5 6.5 0 010 9',
  soundOff: 'M3 8h3l4-3v10l-4-3H3zM13 8l4 4M17 8l-4 4',
} as const;

export function Icon({ name }: { name: keyof typeof PATHS | 'play' }) {
  if (name === 'play') {
    return (
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2.5 1.5v9l8-4.5z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}
