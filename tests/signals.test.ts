import test from "node:test";
import assert from "node:assert/strict";
import { extractSignals } from "../src/lib/signals.ts";
import type { VideoLite, ChannelLite } from "../src/lib/types.ts";

let n = 0;
function vid(over: Partial<VideoLite> & { title: string }): VideoLite {
  n += 1;
  return {
    id: `v${n}`,
    channelTitle: "Chan A",
    channelId: "UC-A",
    durationSec: 600,
    publishedAt: "2026-10-15T10:00:00Z",
    category: "Entertainment",
    ...over,
  };
}

const subs = (count: number): ChannelLite[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `UC-S${i}`,
    title: `Sub ${i}`,
    subscriberCount: 1000,
  }));

const run = (
  liked: VideoLite[],
  subCount = 0,
  playlists: string[] = [],
  watchLater: VideoLite[] = []
) => extractSignals(liked, subs(subCount), playlists, watchLater);

test("10 videos, 4 shorts -> shortsRatio 0.4", () => {
  const liked = [
    ...Array.from({ length: 4 }, (_, i) => vid({ title: `short ${i}`, durationSec: 45 })),
    ...Array.from({ length: 6 }, (_, i) => vid({ title: `long ${i}`, durationSec: 900 })),
  ];
  assert.equal(run(liked).shortsRatio, 0.4);
});

test("#shorts in title counts as a short even when long", () => {
  const liked = [vid({ title: "compilation #shorts", durationSec: 300 })];
  assert.equal(run(liked).shortsRatio, 1);
});

test("all videos same channel -> topicEntropy 0", () => {
  const liked = Array.from({ length: 6 }, (_, i) => vid({ title: `t${i}` }));
  assert.equal(run(liked).topicEntropy, 0);
});

test("3 channels evenly -> topicEntropy 1", () => {
  const liked = [
    vid({ title: "a1", channelTitle: "Chan A", channelId: "UC-A" }),
    vid({ title: "a2", channelTitle: "Chan A", channelId: "UC-A" }),
    vid({ title: "b1", channelTitle: "Chan B", channelId: "UC-B" }),
    vid({ title: "b2", channelTitle: "Chan B", channelId: "UC-B" }),
    vid({ title: "c1", channelTitle: "Chan C", channelId: "UC-C" }),
    vid({ title: "c2", channelTitle: "Chan C", channelId: "UC-C" }),
  ];
  assert.equal(run(liked).topicEntropy, 1);
});

test("skewed channels -> entropy between 0 and 1", () => {
  const liked = [
    vid({ title: "a1", channelTitle: "Chan A", channelId: "UC-A" }),
    vid({ title: "a2", channelTitle: "Chan A", channelId: "UC-A" }),
    vid({ title: "b1", channelTitle: "Chan B", channelId: "UC-B" }),
  ];
  const e = run(liked).topicEntropy;
  assert.ok(e > 0.9 && e < 0.93, String(e)); // 0.9182 / log2(2)
});

test("selfImprovementCount counts productivity videos", () => {
  const liked = [
    vid({ title: "my 5am morning routine for discipline", channelTitle: "GrindSet" }),
    vid({ title: "how to focus with deep work", channelTitle: "FocusLab" }),
    vid({ title: "30 days of habit tracking", channelTitle: "HabitGuy" }),
    vid({ title: "unboxing a new macbook", channelTitle: "GearHead" }),
  ];
  assert.equal(run(liked).selfImprovementCount, 3);
});

test("likeBursts only keeps days with 5+ likes", () => {
  const liked = [
    ...Array.from({ length: 5 }, (_, i) => vid({ title: `spike ${i}`, publishedAt: "2026-10-10T07:00:00Z" })),
    ...Array.from({ length: 3 }, (_, i) => vid({ title: `calm ${i}`, publishedAt: "2026-10-12T07:00:00Z" })),
  ];
  assert.deepEqual(run(liked).likeBursts, [{ date: "2026-10-10", count: 5 }]);
});

test("lateNightCount counts UTC hours 0-5", () => {
  const liked = [
    vid({ title: "a", publishedAt: "2026-10-15T00:00:00Z" }),
    vid({ title: "b", publishedAt: "2026-10-15T05:59:00Z" }),
    vid({ title: "c", publishedAt: "2026-10-15T06:00:00Z" }),
    vid({ title: "d", publishedAt: "2026-10-15T14:00:00Z" }),
  ];
  assert.equal(run(liked).lateNightCount, 2);
});

test("subsVsLikes is subs over likes", () => {
  const s = run([vid({ title: "one liked video" })], 10);
  assert.equal(s.subsVsLikes, 10);
});

test("watchLaterCount comes from the watch later videos", () => {
  const s = run([vid({ title: "liked" })], 0, ["Watch Later", "Gym Stuff"], [
    vid({ title: "essay i swear ill finish" }),
    vid({ title: "course i will take" }),
  ]);
  assert.equal(s.watchLaterCount, 2);
  assert.deepEqual(s.playlistTitles, ["Watch Later", "Gym Stuff"]);
});

test("topChannels is top 5 by like count with sample titles", () => {
  const liked = [
    ...Array.from({ length: 3 }, (_, i) => vid({ title: `pod ${i}`, channelTitle: "Podcast Bros", channelId: "UC-P" })),
    ...Array.from({ length: 2 }, (_, i) => vid({ title: `gym ${i}`, channelTitle: "Gym Rat Energy", channelId: "UC-G" })),
    vid({ title: "solo", channelTitle: "Solo Artist", channelId: "UC-S" }),
  ];
  const s = run(liked);
  assert.deepEqual(s.topChannels, [
    { name: "Podcast Bros", likes: 3 },
    { name: "Gym Rat Energy", likes: 2 },
    { name: "Solo Artist", likes: 1 },
  ]);
  assert.deepEqual(s.topChannelTitles, ["pod 0", "pod 1", "pod 2"]);
  assert.equal(s.sampleTitles.length, 6);
});

test("sampleTitles keeps at most 12 most recent", () => {
  const liked = Array.from({ length: 15 }, (_, i) =>
    vid({ title: `old ${i}`, publishedAt: `2026-09-${String(i + 1).padStart(2, "0")}T10:00:00Z` })
  );
  const s = run(liked);
  assert.equal(s.sampleTitles.length, 12);
  assert.equal(s.sampleTitles[0], "old 14");
  assert.equal(s.sampleTitles[11], "old 3");
});

test("contradictions pair opposed buckets present on >5% of videos", () => {
  const liked = [
    vid({ title: "minimal declutter capsule wardrobe", channelTitle: "Less Is More" }),
    vid({ title: "insane tech haul unboxing macbook", channelTitle: "GearHead" }),
    vid({ title: "morning routine discipline habit", channelTitle: "GrindSet" }),
    vid({ title: "reacting to cringe drama", channelTitle: "Drama King" }),
  ];
  const s = run(liked);
  assert.ok(s.nicheContradictions.includes("minimalism vs techHaul"));
  assert.ok(s.nicheContradictions.includes("selfImprovement vs ragebait"));
});

test("a bucket on only one of ten videos is not a contradiction", () => {
  const liked = [
    vid({ title: "minimal declutter capsule wardrobe", channelTitle: "Less Is More" }),
    ...Array.from({ length: 9 }, (_, i) => vid({ title: `gaming clip ${i}`, channelTitle: "Clip Farm", channelId: "UC-C" })),
  ];
  const s = run(liked);
  assert.ok(!s.nicheContradictions.includes("minimalism vs techHaul"));
});

test("likesPerDay uses the span from oldest like to now", () => {
  const liked = [
    vid({ title: "oldest", publishedAt: "2026-10-06T12:00:00Z" }),
    vid({ title: "newest", publishedAt: "2026-10-16T12:00:00Z" }),
  ];
  const s = extractSignals(liked, [], [], [], new Date("2026-10-16T12:00:00Z"));
  assert.equal(s.likesPerDay, 0.2); // 2 likes / 10 days
});

test("empty inputs -> zeros, no NaN, no throw", () => {
  const s = run([]);
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === "number") assert.ok(Number.isFinite(v), `${k}=${v}`);
  }
  assert.equal(s.totalLikes, 0);
  assert.equal(s.likesPerDay, 0);
  assert.equal(s.shortsRatio, 0);
  assert.equal(s.avgVideoLengthSec, 0);
  assert.equal(s.longestVideoSec, 0);
  assert.equal(s.longestVideoTitle, "");
  assert.equal(s.topicEntropy, 0);
  assert.equal(s.parasocialRatio, 0);
  assert.equal(s.subsVsLikes, 0);
  assert.deepEqual(s.topChannels, []);
  assert.deepEqual(s.likeBursts, []);
  assert.deepEqual(s.sampleTitles, []);
  assert.deepEqual(s.nicheContradictions, []);
});
