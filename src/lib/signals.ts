import { classify, OPPOSED_PAIRS } from "./categories.ts";
import type { ChannelLite, Signals, VideoLite } from "./types.ts";

const DAY = 86_400_000;
const round = (x: number) => Math.round(x * 1e6) / 1e6;

export function extractSignals(
  liked: VideoLite[],
  subs: ChannelLite[],
  playlistTitles: string[],
  watchLater: VideoLite[],
  now: Date = new Date()
): Signals {
  const totalLikes = liked.length;

  // --- velocity ---
  let oldest = now.getTime();
  for (const v of liked) {
    const t = Date.parse(v.publishedAt);
    if (Number.isFinite(t) && t < oldest) oldest = t;
  }
  const spanDays = Math.max(1, Math.ceil((now.getTime() - oldest) / DAY));
  const likesPerDay = totalLikes / spanDays;
  const likesLast7d = liked.filter(
    (v) => now.getTime() - Date.parse(v.publishedAt) <= 7 * DAY
  ).length;

  // --- buckets ---
  const categories: Record<string, number> = {};
  const bucketOf = new Map<string, string[]>();
  for (const v of liked) {
    const hits = classify(v.title, v.channelTitle);
    bucketOf.set(v.id, hits);
    for (const h of hits) categories[h] = (categories[h] ?? 0) + 1;
  }
  const countOf = (bucket: string) =>
    liked.reduce((n, v) => n + (bucketOf.get(v.id)?.includes(bucket) ? 1 : 0), 0);
  const shareOf = (bucket: string) => (totalLikes ? countOf(bucket) / totalLikes : 0);

  // --- length ---
  const durations = liked.map((v) => v.durationSec);
  const shorts = liked.filter((v) => v.durationSec <= 60 || v.title.includes("#shorts"));
  const longest = liked.reduce<VideoLite | null>(
    (best, v) => (!best || v.durationSec > best.durationSec ? v : best),
    null
  );

  // --- entropy over channels ---
  const chanCounts = new Map<string, number>();
  for (const v of liked) chanCounts.set(v.channelTitle, (chanCounts.get(v.channelTitle) ?? 0) + 1);
  let topicEntropy = 0;
  if (chanCounts.size > 1 && totalLikes > 0) {
    let h = 0;
    for (const c of chanCounts.values()) {
      const p = c / totalLikes;
      h -= p * Math.log2(p);
    }
    topicEntropy = round(h / Math.log2(chanCounts.size));
  }

  // --- bursts ---
  const byDay = new Map<string, number>();
  for (const v of liked) {
    const d = v.publishedAt.slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  const likeBursts = [...byDay.entries()]
    .filter(([, count]) => count >= 5)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  // --- top channels ---
  const topChannels = [...chanCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, likes]) => ({ name, likes }));
  const topChannelTitles = topChannels[0]
    ? liked.filter((v) => v.channelTitle === topChannels[0].name).map((v) => v.title)
    : [];

  // --- contradictions ---
  const present = Object.entries(categories)
    .filter(([, c]) => totalLikes > 0 && c / totalLikes > 0.05)
    .map(([b]) => b);
  const nicheContradictions = OPPOSED_PAIRS.filter(
    ([a, b]) => present.includes(a) && present.includes(b)
  ).map(([a, b]) => `${a} vs ${b}`);

  const sortedByDate = [...liked].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  );

  return {
    totalLikes,
    likesLast7d,
    likesPerDay: round(likesPerDay),
    shortsRatio: totalLikes ? round(shorts.length / totalLikes) : 0,
    avgVideoLengthSec: durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0,
    longestVideoSec: longest?.durationSec ?? 0,
    longestVideoTitle: longest?.title ?? "",
    topicEntropy,
    categories,
    parasocialRatio: round(shareOf("parasocial")),
    selfImprovementCount: countOf("selfImprovement"),
    ragebaitCount: countOf("ragebait"),
    procrastinationCount: countOf("procrastination"),
    watchLaterCount: watchLater.length,
    playlistTitles,
    topChannels,
    likeBursts,
    subsVsLikes: round(subs.length / Math.max(1, totalLikes)),
    nicheContradictions,
    topChannelTitles,
    sampleTitles: sortedByDate.slice(0, 12).map((v) => v.title),
    lateNightCount: liked.filter((v) => {
      const h = new Date(v.publishedAt).getUTCHours();
      return h >= 0 && h <= 5;
    }).length,
  };
}
