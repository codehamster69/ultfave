export type Period = "week" | "month" | "year";

export type SessionUser = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  isDemo: boolean;
};

export type LeaderboardRow = {
  rank: number;
  prevRank: number | null;
  delta: number | null;
  userId: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  points: number;
  minutes: number;
  plays: number;
  isMe: boolean;
  isFriend: boolean;
  badges: { id: string; name: string; icon: string; tier: string }[];
};

export type ArtistSummary = {
  id: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
  followers: number;
};

export type ArtistLeaderboardRow = {
  rank: number;
  prevRank: number | null;
  delta: number | null;
  artist: ArtistSummary;
  points: number;
  minutes: number;
  plays: number;
  fans: number;
  topFan: { name: string; handle: string; avatarUrl: string | null } | null;
};

export type UserBadge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "elite";
  artistId: string | null;
  artistName: string | null;
  earnedAt: string;
};

export type UserStreak = {
  artistId: string;
  artistName: string;
  imageUrl: string | null;
  current: number;
  longest: number;
  lastDay: string | null;
};

export type Challenge = {
  id: string;
  title: string;
  description: string;
  artistId: string | null;
  artistName: string | null;
  metric: "minutes" | "plays" | "distinct_tracks";
  target: number;
  bonusPoints: number;
  startsOn: string;
  endsOn: string;
  joined: boolean;
  completed: boolean;
  progress: number;
  participants: number;
};

export type ActivityEvent = {
  id: string;
  kind: string;
  message: string;
  actorName: string | null;
  actorHandle: string | null;
  actorAvatarUrl: string | null;
  artistId: string | null;
  artistName: string | null;
  createdAt: string;
  meta: Record<string, unknown>;
};

export type RankSnapshot = {
  userId: string;
  artistId: string;
  period: Period;
  rank: number;
  points: number;
  capturedAt: string;
};

export type UserProfile = {
  user: SessionUser;
  badges: UserBadge[];
  streaks: UserStreak[];
  topArtists: {
    artistId: string;
    artistName: string;
    imageUrl: string | null;
    points: number;
    minutes: number;
    rank: number | null;
  }[];
  totals: { points: number; minutes: number; plays: number; artists: number };
};

export type SpotifyPlay = {
  trackId: string;
  trackName: string;
  artistId: string;
  artistName: string;
  albumImage: string | null;
  durationMs: number;
  playedAt: string;
};
