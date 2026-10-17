import type { ChannelLite, VideoLite } from "./types.ts";

const API = "https://www.googleapis.com/youtube/v3";
// Typical roast run ~9 quota units (worst case ~13); hard-stop before spending more.
export const QUOTA_BUDGET = 20;

const CATEGORIES: Record<string, string> = {
  "1": "Film & Animation",
  "2": "Autos & Vehicles",
  "10": "Music",
  "15": "Pets & Animals",
  "17": "Sports",
  "19": "Travel & Events",
  "20": "Gaming",
  "22": "People & Blogs",
  "23": "Comedy",
  "24": "Entertainment",
  "25": "News & Politics",
  "26": "Howto & Style",
  "27": "Education",
  "28": "Science & Technology",
  "29": "Nonprofits & Activism",
};

export type Collected = {
  liked: VideoLite[];
  subs: ChannelLite[];
  playlistTitles: string[];
  watchLater: VideoLite[];
};

export class QuotaError extends Error {}
export class WatchHistoryLocked extends Error {}

// Minimal shapes for what we read from YouTube Data API v3 list endpoints.
type YtItem = {
  id?: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    channelId?: string;
    publishedAt?: string;
    categoryId?: string;
    relatedChannelId?: string;
    subscriberCount?: string | number;
    videoOwnerChannelTitle?: string;
    videoOwnerChannelId?: string;
  };
  contentDetails?: {
    videoId?: string;
    duration?: string;
    videoPublishedAt?: string;
    relatedPlaylists?: { likes?: string; watchLater?: string };
  };
};

type YtListResponse = {
  items?: YtItem[];
  nextPageToken?: string;
};

export function durationToSec(iso: string): number {
  // ISO-8601 duration from videos.list; also handles weeks (P#W).
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  const [, w, d, h, min, s] = m;
  return (
    (Number(w ?? 0) * 604800) +
    (Number(d ?? 0) * 86400) +
    (Number(h ?? 0) * 3600) +
    (Number(min ?? 0) * 60) +
    Number(s ?? 0)
  );
}

async function call(
  path: string,
  params: Record<string, string>,
  token: string,
  spent: { units: number },
  cost: number
): Promise<YtListResponse> {
  if (spent.units + cost > QUOTA_BUDGET) {
    throw new QuotaError(
      `Refusing call: projected quota ${spent.units + cost} exceeds budget ${QUOTA_BUDGET}`
    );
  }
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    let msg = "";
    let reason = "";
    try {
      const body = await res.json();
      msg = body?.error?.message ?? "";
      reason = body?.error?.errors?.[0]?.reason ?? "";
    } catch {
      /* keep empty */
    }
    if (reason === "watchHistoryNotAccessible") {
      throw new WatchHistoryLocked(
        "Watch history is not accessible via the YouTube API (Google never opened it). Roasting from likes, subs and playlists instead."
      );
    }
    throw new Error(`YouTube API ${res.status}${reason ? ` (${reason})` : ""}: ${msg}`);
  }
  spent.units += cost;
  return res.json();
}

export async function collect(accessToken: string): Promise<Collected> {
  const spent = { units: 0 };

  // 1 unit: my channel -> liked playlist id
  const ch = await call(
    "/channels",
    { part: "contentDetails,snippet", mine: "true" },
    accessToken,
    spent,
    1
  );
  const mine = ch.items?.[0];
  if (!mine) throw new Error("No YouTube channel for this account");
  const likedPlaylist = mine.contentDetails?.relatedPlaylists?.likes;
  const watchLaterPlaylist = mine.contentDetails?.relatedPlaylists?.watchLater;
  if (!likedPlaylist) {
    throw new Error("No liked-videos playlist on this channel. Make your Likes playlist public (YouTube Studio → Content → Likes → Visibility).");
  }

  // 1 unit each: 4 pages x 50 liked videos
  const likedItems: YtItem[] = [];
  let pageToken = "";
  for (let page = 0; page < 4; page++) {
    const params: Record<string, string> = {
      part: "contentDetails,snippet",
      playlistId: likedPlaylist,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;
    const pl = await call("/playlistItems", params, accessToken, spent, 1);
    likedItems.push(...(pl.items ?? []));
    pageToken = pl.nextPageToken ?? "";
    if (!pageToken) break;
  }

  // 1 unit per 50 ids: durations + categories for liked videos
  const likedIds = likedItems
    .map((i) => i.contentDetails?.videoId)
    .filter(Boolean);
  const liked: VideoLite[] = [];
  for (let i = 0; i < likedIds.length; i += 50) {
    const batch = likedIds.slice(i, i + 50);
    const vids = await call(
      "/videos",
      { part: "contentDetails,snippet", id: batch.join(",") },
      accessToken,
      spent,
      1
    );
    for (const v of vids.items ?? []) {
      liked.push({
        id: v.id ?? "",
        title: v.snippet?.title ?? "",
        channelTitle: v.snippet?.channelTitle ?? "",
        channelId: v.snippet?.channelId ?? "",
        durationSec: durationToSec(v.contentDetails?.duration ?? ""),
        publishedAt: v.snippet?.publishedAt ?? "",
        category: CATEGORIES[v.snippet?.categoryId ?? ""] ?? "Unknown",
      });
    }
  }

  // 1 unit: subscriptions (first 50)
  const subsRes = await call(
    "/subscriptions",
    { part: "snippet", mine: "true", maxResults: "50" },
    accessToken,
    spent,
    1
  );
  const subs: ChannelLite[] = (subsRes.items ?? []).map((s) => ({
    id: s.snippet?.relatedChannelId ?? "",
    title: s.snippet?.title ?? "",
    subscriberCount: Number(s.snippet?.subscriberCount ?? 0) || 0,
  }));

  // 1 unit: my playlists -> titles
  const plRes = await call(
    "/playlists",
    { part: "snippet", mine: "true", maxResults: "50" },
    accessToken,
    spent,
    1
  );
  const playlistTitles = (plRes.items ?? []).map(
    (p) => p.snippet?.title ?? ""
  );

  // 1 unit: Watch Later count (titles only, first 50)
  const watchLater: VideoLite[] = [];
  if (watchLaterPlaylist) {
    try {
      const wl = await call(
        "/playlistItems",
        { part: "snippet", playlistId: watchLaterPlaylist, maxResults: "50" },
        accessToken,
        spent,
        1
      );
      for (const it of wl.items ?? []) {
        watchLater.push({
          id: it.contentDetails?.videoId ?? "",
          title: it.snippet?.title ?? "",
          channelTitle: it.snippet?.videoOwnerChannelTitle ?? "",
          channelId: it.snippet?.videoOwnerChannelId ?? "",
          durationSec: 0,
          publishedAt: it.contentDetails?.videoPublishedAt ?? "",
          category: "Unknown",
        });
      }
    } catch (e) {
      if (!(e instanceof WatchHistoryLocked)) throw e;
      // watch later locked private: fine, count stays 0
    }
  }

  return { liked, subs, playlistTitles, watchLater };
}
