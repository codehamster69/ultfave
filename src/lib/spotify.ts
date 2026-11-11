import type { SpotifyPlay } from "@/lib/types";

const ACCOUNTS_BASE = "https://accounts.spotify.com";
const API_BASE = "https://api.spotify.com/v1";

const SPOTIFY_SCOPES = [
  "user-read-recently-played",
  "user-read-email",
  "user-read-private",
  "user-top-read",
].join(" ");

const FALLBACK_REDIRECT_URI = "http://127.0.0.1:3000/api/auth/spotify/callback";

type SpotifyImage = { url?: string | null; width?: number | null; height?: number | null };

type SpotifyArtistRef = { id?: string | null; name?: string | null };

type SpotifyTrack = {
  id?: string | null;
  name?: string | null;
  duration_ms?: number | null;
  artists?: SpotifyArtistRef[] | null;
  album?: { images?: SpotifyImage[] | null } | null;
};

type RecentlyPlayedItem = {
  track?: SpotifyTrack | null;
  played_at?: string | null;
};

type RecentlyPlayedResponse = { items?: RecentlyPlayedItem[] | null };

type ProfileResponse = {
  id?: string | null;
  display_name?: string | null;
  country?: string | null;
  images?: SpotifyImage[] | null;
};

type TokenResponse = {
  access_token?: string | null;
  refresh_token?: string | null;
  expires_in?: number | null;
  token_type?: string | null;
};

function clientId(): string {
  return (process.env.SPOTIFY_CLIENT_ID ?? "").trim();
}

function clientSecret(): string {
  return (process.env.SPOTIFY_CLIENT_SECRET ?? "").trim();
}

function redirectUri(): string {
  const configured = (process.env.SPOTIFY_REDIRECT_URI ?? "").trim();
  return configured.length > 0 ? configured : FALLBACK_REDIRECT_URI;
}

function basicAuthHeader(): string {
  const raw = `${clientId()}:${clientSecret()}`;
  return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
}

async function bodySnippet(res: Response): Promise<string> {
  try {
    const text = await res.text();
    const flat = text.replace(/\s+/g, " ").trim();
    if (flat.length === 0) return "<empty body>";
    return flat.length > 240 ? `${flat.slice(0, 240)}...` : flat;
  } catch {
    return "<unreadable body>";
  }
}

async function spotifyError(label: string, res: Response): Promise<Error> {
  const snippet = await bodySnippet(res);
  const statusText = res.statusText ? ` ${res.statusText}` : "";
  return new Error(`Spotify ${label} failed: ${res.status}${statusText} - ${snippet}`);
}

function requireConfigured(): void {
  if (!isSpotifyConfigured()) {
    throw new Error(
      "Spotify is not configured: set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET",
    );
  }
}

function requireToken(accessToken: string, label: string): void {
  if (!accessToken || accessToken.trim().length === 0) {
    throw new Error(`Spotify ${label} failed: missing access token`);
  }
}

export function isSpotifyConfigured(): boolean {
  return clientId().length > 0 && clientSecret().length > 0;
}

export function getAuthorizeUrl(state: string): string {
  requireConfigured();
  const params = new URLSearchParams({
    client_id: clientId(),
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SPOTIFY_SCOPES,
    state,
  });
  return `${ACCOUNTS_BASE}/authorize?${params.toString()}`;
}

export async function exchangeCode(
  code: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  requireConfigured();
  if (!code || code.trim().length === 0) {
    throw new Error("Spotify token exchange failed: missing authorization code");
  }

  const res = await fetch(`${ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    }),
    cache: "no-store",
  });

  if (!res.ok) throw await spotifyError("token exchange", res);

  const data = (await res.json()) as TokenResponse;
  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  if (!accessToken) {
    throw new Error("Spotify token exchange failed: response did not include an access token");
  }
  if (!refreshToken) {
    throw new Error("Spotify token exchange failed: response did not include a refresh token");
  }

  return {
    accessToken,
    refreshToken,
    expiresIn: typeof data.expires_in === "number" && data.expires_in > 0 ? data.expires_in : 3600,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number; refreshToken?: string }> {
  requireConfigured();
  if (!refreshToken || refreshToken.trim().length === 0) {
    throw new Error("Spotify token refresh failed: missing refresh token");
  }

  const res = await fetch(`${ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  if (!res.ok) throw await spotifyError("token refresh", res);

  const data = (await res.json()) as TokenResponse;
  const accessToken = data.access_token;
  if (!accessToken) {
    throw new Error("Spotify token refresh failed: response did not include an access token");
  }

  return {
    accessToken,
    expiresIn: typeof data.expires_in === "number" && data.expires_in > 0 ? data.expires_in : 3600,
    ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
  };
}

export async function fetchSpotifyProfile(accessToken: string): Promise<{
  id: string;
  displayName: string;
  avatarUrl: string | null;
  country: string | null;
}> {
  requireToken(accessToken, "profile fetch");

  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) throw await spotifyError("profile fetch", res);

  const data = (await res.json()) as ProfileResponse;
  const id = data.id;
  if (!id) {
    throw new Error("Spotify profile fetch failed: response did not include a user id");
  }

  const name = (data.display_name ?? "").trim();
  const image = data.images?.[0]?.url ?? null;

  return {
    id,
    displayName: name.length > 0 ? name : id,
    avatarUrl: image && image.trim().length > 0 ? image : null,
    country: data.country ?? null,
  };
}

function toSpotifyPlay(item: RecentlyPlayedItem): SpotifyPlay | null {
  const track = item.track;
  const playedAt = item.played_at;
  if (!track || !track.id || !playedAt) return null;

  const primaryArtist = track.artists?.[0];
  if (!primaryArtist || !primaryArtist.id) return null;

  const duration = typeof track.duration_ms === "number" ? track.duration_ms : 0;
  const image = track.album?.images?.[0]?.url ?? null;

  return {
    trackId: track.id,
    trackName: track.name ?? "Unknown track",
    artistId: primaryArtist.id,
    artistName: primaryArtist.name ?? "Unknown artist",
    albumImage: image && image.trim().length > 0 ? image : null,
    durationMs: duration,
    playedAt,
  };
}

export async function fetchRecentlyPlayed(accessToken: string): Promise<SpotifyPlay[]> {
  requireToken(accessToken, "recently-played fetch");

  const res = await fetch(`${API_BASE}/me/player/recently-played?limit=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  // Spotify answers 204 when the history is empty; treat it as zero plays.
  if (res.status === 204) return [];
  if (!res.ok) throw await spotifyError("recently-played fetch", res);

  const data = (await res.json()) as RecentlyPlayedResponse;
  const items = data.items ?? [];
  const plays: SpotifyPlay[] = [];

  for (const item of items) {
    const play = toSpotifyPlay(item);
    if (play) plays.push(play);
  }

  return plays;
}
