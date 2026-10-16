export function ScoreGauge({
  score,
  tier,
}: {
  score: number;
  tier: string;
}) {
  const angle = -90 + (Math.min(100, Math.max(0, score)) / 100) * 180;
  const arc = (start: number, end: number, color: string) => {
    const r = 84;
    const x1 = 100 + r * Math.cos((Math.PI / 180) * start);
    const y1 = 100 + r * Math.sin((Math.PI / 180) * start);
    const x2 = 100 + r * Math.cos((Math.PI / 180) * end);
    const y2 = 100 + r * Math.sin((Math.PI / 180) * end);
    return (
      <path
        d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
        stroke={color}
        strokeWidth={14}
        fill="none"
        strokeLinecap="butt"
      />
    );
  };
  return (
    <figure className="mx-auto w-full max-w-72">
      <svg viewBox="0 0 200 116" role="img" aria-label={`Brain Rot Score ${score} of 100: ${tier}`}>
        {arc(180, 216, "#7a8a5c")}
        {arc(216, 252, "#c2a63a")}
        {arc(252, 288, "#c2712f")}
        {arc(288, 324, "#b3221f")}
        {arc(324, 360, "#6e1412")}
        {Array.from({ length: 11 }, (_, i) => {
          const a = (Math.PI / 180) * (180 + i * 18);
          return (
            <line
              key={i}
              x1={100 + 70 * Math.cos(a)}
              y1={100 + 70 * Math.sin(a)}
              x2={100 + 64 * Math.cos(a)}
              y2={100 + 64 * Math.sin(a)}
              stroke="#1a1613"
              strokeWidth={i % 5 === 0 ? 2.5 : 1.2}
            />
          );
        })}
        <g
          className="needle"
          style={{ ["--needle-angle" as string]: `${angle}deg` }}
        >
          <line
            x1={100}
            y1={100}
            x2={100}
            y2={26}
            stroke="#1a1613"
            strokeWidth={4}
            strokeLinecap="round"
          />
        </g>
        <circle cx={100} cy={100} r={7} fill="#1a1613" />
      </svg>
      <figcaption className="text-center">
        <span className="masthead block text-6xl">{score}</span>
        <span className="dateline mt-1 block">Brain Rot Score / 100</span>
      </figcaption>
    </figure>
  );
}
