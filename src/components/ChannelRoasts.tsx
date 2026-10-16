export function ChannelRoasts({
  roasts,
}: {
  roasts: { channel: string; roast: string }[];
}) {
  if (roasts.length === 0) return null;
  return (
    <ul className="divide-y-2 divide-[var(--ink)]/15">
      {roasts.map((r) => (
        <li key={r.channel} className="grid gap-1 py-4 sm:grid-cols-[16rem_1fr] sm:gap-6">
          <h3 className="font-display text-xl leading-tight">
            {r.channel}
          </h3>
          <p className="text-[1.02rem] leading-6">{r.roast}</p>
        </li>
      ))}
    </ul>
  );
}
