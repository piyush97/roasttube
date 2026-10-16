import type { Collected } from "./youtube.ts";
import type { ChannelLite, VideoLite } from "./types.ts";

const DAY = 86_400_000;
const HOUR = 3_600_000;

// Deterministic pseudo-random so personas are stable across runs.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function iso(daysAgo: number, hour = 12, minute = 0): string {
  const d = new Date(Date.now() - daysAgo * DAY);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

function v(
  id: string,
  title: string,
  channelTitle: string,
  durationSec: number,
  publishedAt: string,
  category = "Entertainment"
): VideoLite {
  return {
    id,
    title,
    channelTitle,
    channelId: `UCdemo${id}`,
    durationSec,
    publishedAt,
    category,
  };
}

function ch(n: number, prefix: string): ChannelLite[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `UCsub${prefix}${i}`,
    title: `${prefix} channel ${i + 1}`,
    subscriberCount: 1000 + i * 137,
  }));
}

// --- lurker: 300 subs, 11 likes, Watch Later of 212 (40 productivity) ---
function lurker(): Collected {
  const liked = [
    v("lk1", "My 5am morning routine that changed everything", "Daily Discipline", 640, iso(30)),
    v("lk2", "How to focus for 4 hours straight", "Deep Work Daily", 512, iso(45)),
    v("lk3", "I quit dopamine for 30 days", "Monk Mode Mike", 890, iso(60)),
    v("lk4", "The stoic mindset explained", "Porch Philosophy", 1204, iso(80)),
    v("lk5", "Why you're always tired", "Wellness Wire", 480, iso(90)),
    v("lk6", "Notion setup for your entire life", "Setup Sam", 1580, iso(100)),
    v("lk7", "Journaling for beginners (do this daily)", "Habit Hacker", 620, iso(120)),
    v("lk8", "Stop being lazy: 100 days challenge", "Grindset Gary", 733, iso(140)),
    v("lk9", "Digital detox: I deleted everything", "Simple Sam", 945, iso(160)),
    v("lk10", "The productivity trap", "Calm Corner", 1102, iso(180)),
    v("lk11", "How to become a different person in 6 months", "Level Up Life", 861, iso(200)),
  ];
  const prodTitles = [
    "morning routine", "night routine", "how to focus", "dopamine detox",
    "deep work", "habit tracker", "monk mode", "5am club", "goal setting",
    "journal prompt", "stoic morning", "meditation for beginners", "30 days challenge",
    "100 days of discipline", "level up your life", "glow up routine", "become disciplined",
    "stop procrastinating", "productivity system", "notion template",
  ];
  const watchLater: VideoLite[] = [];
  for (let i = 0; i < 212; i++) {
    const t = prodTitles[i % prodTitles.length];
    watchLater.push(
      v(`wl${i}`, `${t} — you need this`, "Self Improvement Central", 700 + (i % 9) * 120, iso(2 + (i % 300)))
    );
  }
  return {
    liked,
    subs: ch(300, "lurker"),
    playlistTitles: ["Watch Later", "Self Improvement Central", "Podcasts I'll get to", "Gym motivation", "Read later (videos)"],
    watchLater,
  };
}

// --- gremlin: 240 likes in 7 days, 92% shorts, 3am bursts ---
function gremlin(): Collected {
  const rand = rng(42);
  const rage = [
    "WORST TAKE on the internet", "cringe compilation part 9", "reacting to your favorite channel",
    "this streamer got CANCELLED", "the beef explained", "apology video breakdown",
    "he got ratioed into oblivion", "unhinged streamer moment", "debunking the biggest lie",
    "drama explained in 60 seconds",
  ];
  const shortish = [
    "#shorts satisfying loop", "satisfying slime loop", "fyp or die", "ypp wait for it",
    "only on loop", "satisfying factory", "#shorts rage bait", "instant regret",
  ];
  const liked: VideoLite[] = [];
  for (let i = 0; i < 240; i++) {
    const isShort = rand() < 0.92;
    const title = isShort
      ? shortish[i % shortish.length]
      : rage[i % rage.length];
    const hour = rand() < 0.45 ? 3 : Math.floor(rand() * 24); // 3am bursts
    liked.push(
      v(
        `gr${i}`,
        title,
        isShort ? "Shorts Gremlin" : "Drama Daily",
        isShort ? 15 + Math.floor(rand() * 45) : 600 + Math.floor(rand() * 900),
        iso(rand() * 7, hour, Math.floor(rand() * 60))
      )
    );
  }
  return {
    liked,
    subs: ch(58, "gremlin"),
    playlistTitles: ["Watch Later", "drama to watch later", "reaction deep cuts"],
    watchLater: liked.slice(0, 30),
  };
}

// --- essay-hoarder: 4h11m essay at 02:40, minimalism + 14 tech-haul channels ---
function essayHoarder(): Collected {
  const liked: VideoLite[] = [
    v("eh1", "The entire history of cinema: a 4 hour video essay", "KurosawaLong", 15082, iso(12, 2, 40), "Film & Animation"),
    v("eh2", "Why slow cinema matters (90 minute essay)", "Frame by Frame", 5400, iso(20, 1, 15), "Film & Animation"),
    v("eh3", "I own 12 things: minimalism tour", "Empty Room", 840, iso(30)),
    v("eh4", "Digital detox changed my brain", "Empty Room", 1100, iso(35)),
    v("eh5", "Capsule wardrobe: one year later", "Empty Room", 720, iso(40)),
    v("eh6", "MASSIVE tech haul 2026", "Gadget Goblin", 1350, iso(5)),
    v("eh7", "New keyboard setup tour", "Keyboard Karen", 980, iso(8)),
    v("eh8", "MacBook Pro unboxing (again)", "Gadget Goblin", 640, iso(10)),
    v("eh9", "Everyday carry update", "EDC Edge", 560, iso(14)),
    v("eh10", "Desk setup that made me productive", "Setup Sam", 890, iso(18)),
    v("eh11", "I bought every flagship phone", "Gadget Goblin", 1420, iso(22)),
    v("eh12", "Camera gear haul: what I actually use", "Lens Lurker", 1010, iso(25)),
  ];
  const subs = [
    ...ch(3, "minimal"),
    ...ch(14, "tech haul"),
    ...ch(21, "video essay"),
  ];
  return {
    liked,
    subs,
    playlistTitles: ["Watch Later", "Video essays (never finish)", "Tech hauls to research", "Minimalism inspiration"],
    watchLater: Array.from({ length: 47 }, (_, i) =>
      v(`ehwl${i}`, `video essay part ${i + 1}`, "Longform Lurker", 3600 + i * 60, iso(1 + i))
    ),
  };
}

export const DEMO_PERSONAS = ["lurker", "gremlin", "essay-hoarder"] as const;
export type DemoPersona = (typeof DEMO_PERSONAS)[number];

export function getDemoPersona(name: string): Collected | null {
  switch (name) {
    case "lurker":
      return lurker();
    case "gremlin":
      return gremlin();
    case "essay-hoarder":
      return essayHoarder();
    default:
      return null;
  }
}
