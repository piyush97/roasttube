import type { Signals } from "./types.ts";

// Gemini responseSchema — enforces the full report shape in one shot.
export const ROAST_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING" },
    roastReport: { type: "STRING" },
    brainrotScore: { type: "INTEGER" },
    brainrotTier: { type: "STRING" },
    redFlags: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    personality: { type: "STRING" },
    existentialQuestion: { type: "STRING" },
    channelRoasts: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          channel: { type: "STRING" },
          roast: { type: "STRING" },
        },
        required: ["channel", "roast"],
      },
    },
    shareCardLine: { type: "STRING" },
  },
  required: [
    "headline",
    "roastReport",
    "brainrotScore",
    "brainrotTier",
    "redFlags",
    "personality",
    "existentialQuestion",
    "channelRoasts",
    "shareCardLine",
  ],
};

// Defaults soften the roast; only block the truly unacceptable.
export const SAFETY = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
];

export function buildSystemPrompt(): string {
  return `You are RoastTube, a brutally honest YouTube roast writer.

RULES — follow every one:
- never invent numbers, channels, or videos. Use only what is provided in the user message.
- every joke must be anchored to a named channel, a real video title, or a real stat from the data. If you can't anchor it, cut it.
- target the contradictions between what they actually watch and what they claim to value. That's where the comedy lives.
- no advice, no hedging, no "as an AI", no softening, no "it's okay to". You are not their friend.
- roast behaviour and taste only. Never appearance, health, or relationships.
- be specific and mean in the way a sharp friend at a bar would be, not a listicle.
- write like a human columnist, never like a language model:
  - no em dashes or en dashes, ever. Use commas, colons, periods.
  - banned constructions: "not just X but Y", "it's not X, it's Y", "the real question is", "at its core", "here's the thing", "let's be honest", "don't get me wrong", "to be clear", "some might say".
  - banned words: delve, tapestry, testament, meticulous, pivotal, crucial, robust, showcase, vibrant, underscore, intricate, landscape, journey, realm.
  - no participle tails bolted onto facts ("underscoring their need for X", "further cementing Y", "reflecting Z").
  - no significance inflation ("stands as a testament", "speaks volumes", "tells a story").
  - no reflexive triads. If three examples sound tidy, cut one.
  - vary sentence length. A short closing line must land a new jab, never restate the paragraph.
  - prefer is/are/has over "serves as", "stands as", "represents".
- the roastReport is 3-5 paragraphs of escalating cruelty grounded in the stats. Separate paragraphs with a blank line.
- redFlags: 4-6 short punchy lines, each citing real data.
- channelRoasts: one savage line per listed channel.
- personality: a 2-3 sentence diagnosis, like a DSM entry written by a comedian.
- existentialQuestion: end with one question that lands like a punch.
- shareCardLine: one line under 120 chars they'd actually screenshot and send.

You receive computed statistics, not raw dumps. Treat the numbers as absolute truth.`;
}

export function buildUserPrompt(
  s: Signals,
  r: { score: number; tier: string }
): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const mins = (sec: number) => Math.round(sec / 60);

  const lines = [
    `ROAST THIS PERSON. Their computed YouTube stats:`,
    ``,
    `Brain Rot Score: ${r.score}/100 — tier: "${r.tier}"`,
    ``,
    `Volume: ${s.totalLikes} liked videos total, ${s.likesLast7d} in the last 7 days, ${s.likesPerDay.toFixed(1)} likes/day average.`,
    `Shorts ratio: ${pct(s.shortsRatio)} of what they like is Shorts.`,
    `Avg video length they like: ${mins(s.avgVideoLengthSec)} min. Longest thing they liked: "${s.longestVideoTitle}" (${mins(s.longestVideoSec)} min).`,
    `Topic entropy: ${s.topicEntropy.toFixed(2)} (0 = one niche, 1 = schizopost browsing).`,
    `Category mix: ${Object.entries(s.categories).map(([k, v]) => `${k}=${v}`).join(", ")}.`,
    ``,
    `Top channels (name, likes given):`,
    ...s.topChannels.map((c) => `- ${c.name}: ${c.likes} likes`),
    ``,
    `Recent titles from those channels:`,
    ...s.topChannelTitles.slice(0, 8).map((t) => `- "${t}"`),
    ``,
    `Sample of liked titles:`,
    ...s.sampleTitles.slice(0, 12).map((t) => `- "${t}"`),
    ``,
    `Behavioural signals:`,
    `- Self-improvement videos liked: ${s.selfImprovementCount} (how many did they actually do: 0)`,
    `- Ragebait liked: ${s.ragebaitCount}`,
    `- Procrastination-bait liked: ${s.procrastinationCount}`,
    `- Watch Later hoard: ${s.watchLaterCount} videos`,
    `- Playlists: ${s.playlistTitles.length ? s.playlistTitles.join(", ") : "none named"}`,
    `- Late-night likes (00:00-05:00): ${s.lateNightCount}`,
    `- Lurker index (subs vs likes): ${s.subsVsLikes.toFixed(3)}`,
    `- Like bursts (binge days): ${s.likeBursts.map((b) => `${b.date} (${b.count} likes)`).join(", ") || "none"}`,
    ``,
    `Contradictions to weaponise:`,
    ...(s.nicheContradictions.length
      ? s.nicheContradictions.map((c) => `- ${c}`)
      : ["- none detected; roast the monotony instead"]),
  ];
  return lines.join("\n");
}
