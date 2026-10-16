export function RedFlagCard({
  flag,
  index,
}: {
  flag: string;
  index: number;
}) {
  return (
    <blockquote
      className="clipping relative p-5 pl-7 text-[1.02rem] leading-6 italic"
      style={{ transform: `rotate(${index % 2 === 0 ? -0.7 : 0.6}deg)` }}
    >
      <svg
        className="absolute -top-3 left-3"
        width="26"
        height="30"
        viewBox="0 0 26 30"
        aria-hidden
      >
        <line x1="4" y1="2" x2="4" y2="28" stroke="#1a1613" strokeWidth="2.5" />
        <path d="M6 3 L24 7 L6 13 Z" fill="#b3221f" />
      </svg>
      “{flag}”
    </blockquote>
  );
}
