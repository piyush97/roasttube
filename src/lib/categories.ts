// Lowercase substring buckets. Matched against `title + " " + channelTitle`.
// Deliberately blunt: this feeds a score, not a search engine.
export const BUCKETS: Record<string, string[]> = {
  selfImprovement: [
    "5am", "5 am", "morning routine", "night routine", "self improvement",
    "self-improvement", "productivity", "discipline", "dopamine", "habit",
    "monk mode", "deep work", "how to focus", "notion", "todo", "goal",
    "journal", "stoic", "meditation", "30 days", "100 days", "level up",
    "glow up", "become", "stop being",
  ],
  ragebait: [
    "rage", "cringe", "drama", "reacting to", "reaction", "cancelled",
    "beef", "apology video", "exposed", "debunk", "worst", "worst take",
    "ratio", "diss", "clickbait", "unhinged",
  ],
  procrastination: [
    "procrastinat", "doomscroll", "doom scroll", "9 hours", "10 hours",
    "100 hours", "binge", "can't stop", "cant stop", "addicted", "all night",
    "3am", "3 am", "wasted my life", "watched every", "entire series",
  ],
  parasocial: [
    "podcast", "interview", "livestream", "live stream", "vlog", "q&a",
    "qa ", "ask me anything", "tier list", "tier ranking", "reacts to",
    "commentary", "video essay", "essay", "behind the scenes", "community post",
  ],
  gaming: [
    "gameplay", "let's play", "speedrun", "ranked", "no hit", "playthrough",
    "boss fight", "minecraft", "elden ring", "baldur", "fifa", "cod ",
    "valorant", "league of legends", "souls", "modded", "hardcore",
  ],
  shortsCulture: ["#shorts", "shorts", "ypp", "fyp", "loop", "satisfying"],
  finance: [
    "invest", "stock", "crypto", "portfolio", "passive income", "etf",
    "bitcoin", "options trading", "dividend", "get rich", "money", "budget",
    "side hustle", "millionaire",
  ],
  fitness: [
    "gym", "workout", "bulk", "cut ", "protein", "calisthenics", "deadlift",
    "squat", "weight loss", "abs", "six pack", "run 5k", "marathon", "yoga",
  ],
  techHaul: [
    "tech haul", "unbox", "setup", "gear", "review", "keyboard", "macbook",
    "iphone", "pixel ", "camera", "everyday carry", "edc", "desk setup",
    "gift guide",
  ],
  minimalism: [
    "minimal", "declutter", "capsule", "digital detox", "dopamine detox",
    "cleanse", "own less", "quit", "fast from", "no buy", "simplify",
  ],
  news: ["news", "breaking", "politic", "election", "explained", "documentary"],
};

export function classify(title: string, channelTitle: string): string[] {
  const hay = `${title} ${channelTitle}`.toLowerCase();
  const hits: string[] = [];
  for (const [bucket, terms] of Object.entries(BUCKETS)) {
    for (const t of terms) {
      if (hay.includes(t)) {
        hits.push(bucket);
        break;
      }
    }
  }
  return hits;
}

// Pairs that mean the user is at war with themselves.
export const OPPOSED_PAIRS: [string, string][] = [
  ["minimalism", "techHaul"],
  ["selfImprovement", "ragebait"],
  ["selfImprovement", "procrastination"],
  ["finance", "techHaul"],
  ["fitness", "procrastination"],
];
