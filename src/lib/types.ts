export type VideoLite = {
  id: string;
  title: string;
  channelTitle: string;
  channelId: string;
  durationSec: number;
  publishedAt: string; // ISO-8601
  category: string; // human label, e.g. "Film & Animation"
};

export type ChannelLite = {
  id: string;
  title: string;
  subscriberCount: number;
};

export type Signals = {
  totalLikes: number;
  likesLast7d: number;
  likesPerDay: number;
  shortsRatio: number; // 0..1
  avgVideoLengthSec: number;
  longestVideoSec: number;
  longestVideoTitle: string;
  topicEntropy: number; // 0..1 normalised
  categories: Record<string, number>; // bucket -> count
  parasocialRatio: number; // 0..1
  selfImprovementCount: number;
  ragebaitCount: number;
  procrastinationCount: number;
  watchLaterCount: number;
  playlistTitles: string[];
  topChannels: { name: string; likes: number }[];
  likeBursts: { date: string; count: number }[];
  subsVsLikes: number; // lurker index
  nicheContradictions: string[];
  topChannelTitles: string[];
  sampleTitles: string[];
  lateNightCount: number;
};

export type RoastReport = {
  headline: string;
  roastReport: string;
  brainrotScore: number;
  brainrotTier: string;
  redFlags: string[];
  personality: string;
  existentialQuestion: string;
  channelRoasts: { channel: string; roast: string }[];
  shareCardLine: string;
};

export type StoredReport = {
  id: string;
  createdAt: string;
  source: "demo" | "youtube";
  persona?: string;
  report: RoastReport;
  signals: Signals;
  score: ScoreResult;
};

export type ScoreResult = {
  score: number;
  tier: string;
  breakdown: { factor: string; points: number }[];
};
