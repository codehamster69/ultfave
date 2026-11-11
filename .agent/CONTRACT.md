# FanRank — frozen build contract (v1)

You are one of 10 parallel workers building **FanRank**, a Spotify fandom leaderboard app.
Everything below is frozen. Do not invent new tables, dependencies, routes, types, or
shared helper names. Build only the files assigned to you. Output complete files.

Current date: **2026-11-10** (all demo data is relative to today).

## 1. Product

Fans of an artist earn points for listening. Every artist has a leaderboard with weekly,
monthly and yearly rankings. A global leaderboard ranks artists by total fan points.
Extras: streaks, badges, friends/rivalries, live activity feed, weekly challenges, and a
shareable PNG fan card.

Design voice: late-night stadium scoreboard. Near-black, oversized numerals, lime accent,
mono metadata, confident and competitive. No emoji anywhere. No light mode.

## 2. Stack rules

- Next.js 15.5 App Router, React 19, TypeScript strict, Tailwind CSS v4 (tokens in
  `src/app/globals.css`), libSQL (`@libsql/client`), `jose`, `zod`.
- **Do not add dependencies.** Available: next, react, react-dom, @libsql/client, jose, zod.
- No Next.js server actions. Pages are async server components; mutations are route
  handlers called from client components with `fetch` + `router.refresh()`.
- Path alias `@/*` → `src/*`. Use it everywhere.
- All DB access goes through `@/lib/db` (`all`, `get`, `run`, `batch`). Never create a
  second client.
- JSON and TypeScript use camelCase. DB columns are snake_case. Convert at the SQL edge
  (use `AS "camelCase"` aliases).
- Dates: store ISO strings UTC. Day keys are `YYYY-MM-DD` (UTC). `src/lib/period.ts` owns
  all period math; use it, do not reimplement.
- Next 15 dynamic APIs are async: `const { id } = await params;`,
  `const sp = await searchParams;`, `const cookieStore = await cookies();`.
- Pages must render responsibly with an empty database (empty states, no crashes).
- No `export const revalidate`; session cookies already make pages dynamic.
- No placeholder files, no TODOs, no mock imports. Full implementations only.
- Do not write `package.json`, `tsconfig.json`, `src/lib/schema.sql`, `src/lib/db.ts`,
  `src/lib/types.ts`, `src/lib/period.ts`, `src/app/globals.css`, `src/app/layout.tsx`.

## 3. Already-existing shared code (read-only for you)

### `src/lib/db.ts`
```ts
all<T>(sql: string, args?: InArgs): Promise<T[]>
get<T>(sql: string, args?: InArgs): Promise<T | null>
run(sql: string, args?: InArgs): Promise<ResultSet>
batch(statements: { sql: string; args?: InArgs }[]): Promise<void>
db // libsql client
```

### `src/lib/types.ts`
Exact exported types (do not redefine): `Period`, `SessionUser`, `LeaderboardRow`,
`ArtistSummary`, `ArtistLeaderboardRow`, `UserBadge`, `UserStreak`, `Challenge`,
`ActivityEvent`, `RankSnapshot`, `UserProfile`, `SpotifyPlay`.

### `src/lib/period.ts`
```ts
toDay(date: Date): string
todayUtc(now?: Date): string
addDays(day: string, delta: number): string
isoWeekKey(date: Date): string
periodRange(period: Period, now?: Date): { start; end; key; label; prevStart; prevEnd } // day strings, inclusive
PERIOD_LABEL: Record<Period, string>
isPeriod(value: string | null | undefined): value is Period
formatPoints(points: number): string
formatMinutes(minutes: number): string
timeAgo(iso: string): string
```

### `src/app/layout.tsx`
Renders `<SiteNav />` (you may be its owner) inside max-w-6xl main. Fonts already wired:
`--font-display`, `--font-sans`, `--font-mono`. Metadata is set.

## 4. Design system

Tokens available as Tailwind classes: `ink`, `panel`, `panel2`, `line`, `fg`, `muted`,
`lime`, `magenta`, `peri`, `gold`; fonts `font-display`, `font-sans`, `font-mono`.
Global classes: `.panel`, `.panel-hover`, `.chip`, `.btn`, `.btn-primary`, `.btn-ghost`,
`.num`, `.hairline`, `.rise`, `.live-dot`, `.ticker-mask`.
Use `.num` for every score, rank and stat number. Use `font-display` for headings, tight
tracking (`tracking-tight`), large sizes. Cards use `.panel`; hover rows highlight.
Avatars are monogram circles with deterministic gradient (never external images unless a
real Spotify image URL is present). Rank #1 gets a gold treatment, #2 silver `peri`, #3
bronze/magenta.

## 5. Data model (already migrated — do not change)

`users(id, spotify_id, display_name, handle, avatar_url, country, is_demo,
spotify_access_token, spotify_refresh_token, token_expires_at, last_synced_at, created_at)`

`artists(id, name, image_url, genres (JSON string array), followers, created_at)`

`tracks(id, artist_id, name, album_image, duration_ms)`

`plays(id, user_id, track_id, artist_id, played_at, day, minutes, points, source)`
Unique `(user_id, track_id, played_at)`.

`daily_scores(user_id, artist_id, day, points, minutes, plays, distinct_tracks)`
Primary key `(user_id, artist_id, day)`. This table is the source of truth for leaderboards.

`follows(follower_id, followee_id, created_at)` PK `(follower_id, followee_id)`.

`streaks(user_id, artist_id, current, longest, last_day)` PK `(user_id, artist_id)`.

`badges(id, name, description, icon, tier, rule)`.

`user_badges(user_id, badge_id, artist_id, earned_at)` PK `(user_id, badge_id, artist_id)`.
Note: `artist_id` can be `''` (empty string) for non-artist badges, because SQLite PKs
treat NULLs as distinct. Always use `''` for global badges.

`challenges(id, title, description, artist_id, metric, target, bonus_points, starts_on,
ends_on, created_at)`. `metric` ∈ `minutes | plays | distinct_tracks`; `artist_id` NULL =
any artist.

`challenge_entries(challenge_id, user_id, joined_at, completed_at)`.

`activity_events(id, kind, actor_id, artist_id, target_user_id, message, meta (JSON string),
created_at)`.

`rank_snapshots(user_id, artist_id, period_type, period_key, rank, points, captured_at)`.

## 6. Scoring model

A play contributes: `minutes = min(duration_ms, 480000) / 60000`, `points = minutes`.
For a user/artist/day: `points = minutes + 10 * min(distinct_tracks, 20) + 5 * (plays > 0)`.
This daily formula is implemented in `recomputeDailyScore`.

## 7. Shared libraries — exact exports other workers import

### `src/lib/auth.ts` (worker A2)
```ts
getSession(): Promise<SessionUser | null>        // reads fanrank_session cookie
requireUser(): Promise<SessionUser>             // redirect('/login') if absent
requireApiUser(): Promise<SessionUser | null>
setSession(user: SessionUser): Promise<void>    // route handlers only
clearSession(): Promise<void>
isSpotifyConfigured(): boolean
```
Cookie: `fanrank_session`, JWT HS256 signed with `SESSION_SECRET` (fallback
`dev-secret-change-me`), 30 days, httpOnly, sameSite lax, path `/`, secure in production.

### `src/lib/spotify.ts` (worker A4)
```ts
isSpotifyConfigured(): boolean
getAuthorizeUrl(state: string): string
exchangeCode(code: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>
refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number; refreshToken?: string }>
fetchSpotifyProfile(accessToken: string): Promise<{ id: string; displayName: string; avatarUrl: string | null; country: string | null }>
fetchRecentlyPlayed(accessToken: string): Promise<SpotifyPlay[]>
```

### `src/lib/queries.ts` (worker A1)
```ts
getArtist(artistId: string): Promise<ArtistSummary | null>
listArtists(limit?: number): Promise<ArtistSummary[]>
getArtistLeaderboard(artistId: string, period: Period, viewerId: string | null, limit?: number): Promise<LeaderboardRow[]>
getGlobalArtistLeaderboard(period: Period, limit?: number): Promise<ArtistLeaderboardRow[]>
getUserArtistStanding(userId: string, artistId: string, period: Period): Promise<{ rank: number; total: number; points: number; prevRank: number | null } | null>
getUserTotals(userId: string, period: Period): Promise<{ points: number; minutes: number; plays: number }>
getFriendsLeaderboard(viewerId: string, artistId: string | null, period: Period, limit?: number): Promise<LeaderboardRow[]>
getUserProfile(userId: string): Promise<UserProfile | null>
```
Deltas: `delta = prevRank - rank` (positive = moved up). `prevRank` null when unranked
before. Always include the viewer row in the returned list when they have points, even if
outside `limit` (append it). Sort by points desc, then minutes desc.

### `src/lib/friends.ts` (worker A8)
```ts
followUser(viewerId: string, targetId: string): Promise<void>
unfollowUser(viewerId: string, targetId: string): Promise<void>
isFollowing(viewerId: string, targetId: string): Promise<boolean>
getRivalries(viewerId: string, period: Period): Promise<{
  userId: string; name: string; handle: string; avatarUrl: string | null;
  artistId: string | null; artistName: string | null;
  myPoints: number; theirPoints: number; diff: number; ahead: boolean;
}[]>
detectOvertakes(userId: string, artistId: string, pointsAdded: number): Promise<void>
```
`detectOvertakes` compares today's points for that artist against each friend; when
`pointsAdded` just carried the user past a friend, insert an `overtake` activity event with
message like `"Rohan just overtook Maya on Nova Kestrel"`.

### `src/lib/activity.ts` (worker A9)
```ts
logEvent(input: { kind: string; actorId?: string | null; artistId?: string | null; targetUserId?: string | null; message: string; meta?: Record<string, unknown> }): Promise<void>
getFeed(viewerId: string | null, scope: "global" | "friends", limit?: number): Promise<ActivityEvent[]>
```

### `src/lib/challenges.ts` (worker A9)
```ts
getActiveChallenges(viewerId: string | null): Promise<Challenge[]>
joinChallenge(viewerId: string, challengeId: string): Promise<{ ok: boolean; error?: string }>
settleChallenges(userId: string): Promise<void>   // marks completed entries, grants bonus points + badge
```
`progress` for `minutes`/`plays` sums `daily_scores` in `[starts_on, ends_on]` (filtered by
artist when set); `distinct_tracks` sums `daily_scores.distinct_tracks`. Join is idempotent.

### `src/lib/badges.ts` (worker A7)
```ts
BADGE_DEFS: { id: string; name: string; description: string; icon: string; tier: string; rule: string }[]
ensureBadges(): Promise<void>
evaluateBadges(userId: string): Promise<UserBadge[]>   // awards new ones, returns newly earned
getUserBadges(userId: string): Promise<UserBadge[]>
```
Icon names are from the fixed set: `bolt`, `flame`, `crown`, `disc`, `moon`, `swords`,
`trophy`, `target`.

### `src/lib/streaks.ts` (worker A7)
```ts
awardStreakDay(userId: string, artistId: string, day: string): Promise<void>
getUserStreaks(userId: string, limit?: number): Promise<UserStreak[]>
```

### `src/lib/ingest.ts` (worker A4)
```ts
syncUserPlays(userId: string): Promise<{ imported: number; points: number; error?: string }>
recomputeDailyScore(userId: string, artistId: string, day: string): Promise<void>
```
Flow: get valid token (refresh and persist when needed) → `fetchRecentlyPlayed` → upsert
artists/tracks/plays → `recomputeDailyScore` → `awardStreakDay` (A7) →
`detectOvertakes` (A8) → `settleChallenges` (A9) → `evaluateBadges` (A7).
Catch and isolate each post-step so one failure never aborts the sync.

## 8. API contracts

All handlers: `export const dynamic = "force-dynamic"` (or `runtime = "nodejs"` where
needed). JSON errors: `{ ok: false, error: "message" }` with 400/401/404. Success:
`{ ok: true, ...payload }` unless stated otherwise.

- `GET /api/auth/spotify` → 302 to Spotify (state cookie `fanrank_oauth_state`, 10 min).
  If unconfigured, redirect `/login?error=spotify_not_configured`.
- `GET /api/auth/spotify/callback?code&state` → validate state cookie, exchange, upsert
  user by `spotify_id`, set session, kick off `syncUserPlays` without blocking the redirect,
  redirect `/me?welcome=1`.
- `POST /api/auth/demo` → session as user id `demo-you` (create if missing), redirect `/me`.
- `POST /api/auth/logout` → clear session, redirect `/`.
- `POST /api/sync` → auth required; `syncUserPlays`; `{ ok, imported, points }`.
- `GET /api/cron/sync?secret=` → require `CRON_SECRET`; sync all non-demo users with tokens;
  `{ ok, synced }`.
- `GET /api/leaderboard?artistId=&period=week|month|year&limit=50` → `{ ok, period, rows,
  me }` where `me` is the viewer's `LeaderboardRow | null`.
- `GET /api/leaderboard/artists?period=` → `{ ok, period, rows }`.
- `GET /api/feed?scope=global|friends&limit=30` → `{ ok, events }`.
- `POST /api/follow` body `{ userId, action: "follow" | "unfollow" }` → `{ ok, following }`.
- `POST /api/challenges/[id]/join` → `{ ok }`.
- `GET /api/card/[artistId]?period=week` → 1200×630 PNG via `ImageResponse` from `next/og`.
- `GET /api/sync` is not defined; use POST.

## 9. File ownership (only write these files)

### A1 — data core
- `src/lib/queries.ts`
- `scripts/seed.mjs`
- Seed must be idempotent (delete demo rows first) and insert: 6 artists
  `nova-kestrel`, `midnight-arcade`, `lila`, `paper-satellites`, `jonah-vale`, `kaiju-club`
  (names: Nova Kestrel, Midnight Arcade, LILA, The Paper Satellites, Jonah Vale, KAIJU CLUB;
  genres/followers your choice; `image_url` NULL); 48 demo fans (`is_demo=1`, believable
  names/handles, `avatar_url` NULL) plus fixed user `demo-you` named "Rohan", handle
  "rohan"; 120 days of `daily_scores` (2–4 artists per fan, weekend boosts, some blank
  days); `follows` (demo-you follows 6 fans, fans follow each other); `streaks` for the top
  15 fans; 8 badge rows matching A7's ids; 3 challenges:
  `challenge-nova-sprint` (artist nova-kestrel, minutes, target 180, bonus 150, running
  Monday–Sunday of this week), `challenge-deep-cuts` (artist midnight-arcade,
  distinct_tracks, target 40, bonus 200, same week), `challenge-global-grind` (artist NULL,
  minutes, target 300, bonus 100, this week); seed `challenge_entries` for demo-you on one
  challenge; ~30 `activity_events` across the last 3 days (kinds: `milestone`, `badge`,
  `overtake`, `challenge`, `join`); `rank_snapshots` for demo-you and top fans for the
  previous week/month (so deltas are non-null); plays for the last 7 days for the top 10
  fans (for realism only).
  Use `date` math in plain JS; deterministic seeded RNG (simple LCG) so reseeding is stable.
  Badge ids to seed: `first-blood` (First Blood, "First fan to 100 points on an artist",
  bolt, bronze), `streak-7` (Seven Day Fuse, flame, silver), `streak-30` (Unbroken, flame,
  gold), `top-1` (Inner Circle, crown, elite), `crate-digger` (Crate Digger, disc, silver),
  `night-owl` (Night Owl, moon, bronze), `rivalry` (Rivalry, swords, bronze), `challenger`
  (Challenger, trophy, gold). Rules are stable strings, repeat the tier in `rule`.

### A2 — auth
- `src/lib/auth.ts`
- `src/app/login/page.tsx` (server page + small client buttons inline; shows Spotify CTA
  when configured, always shows "Enter as demo fan", explains the demo universe)
- `src/app/api/auth/spotify/route.ts`
- `src/app/api/auth/spotify/callback/route.ts`
- `src/app/api/auth/demo/route.ts`
- `src/app/api/auth/logout/route.ts`
Imports allowed: `@/lib/db`, `@/lib/types`, `@/lib/spotify`, `@/components/ui`.

### A3 — shell + home + global artists board
- `src/components/site-nav.tsx` (async server component, imports `getSession`; sticky,
  links Home/Artists? use `/`, `/friends`, `/activity`, `/me`; brand FANRANK with lime slash;
  sign-in button or avatar chip + logout form POST `/api/auth/logout`; mobile-friendly)
- `src/components/ui.tsx` with exactly: `Avatar`, `StatCard`, `SectionHeader`,
  `EmptyState`, `Delta` (signatures above are flexible, but these names must exist and be
  usable from server components where sensible; `"use client"` only where needed)
- `src/app/page.tsx` (home: hero headline "WHO REALLY RUNS THE FANDOM?", subcopy, CTA
  row; live activity ticker using A9 `getFeed`; global artists leaderboard using A1
  `getGlobalArtistLeaderboard` + A6 `PeriodTabs`; platform stat strip; responsive)
- `src/app/api/leaderboard/artists/route.ts`
Imports allowed: A1 queries, A2 auth, A6 components, A9 activity, `@/lib/period`.

### A4 — Spotify ingest + scoring
- `src/lib/spotify.ts`
- `src/lib/ingest.ts`
- `src/app/api/sync/route.ts`
- `src/app/api/cron/sync/route.ts`
Imports allowed: `@/lib/db`, `@/lib/types`, `@/lib/period`, `@/lib/auth` (session only in
routes), and the A7/A8/A9 functions listed. Never import queries from A1.

### A5 — artist page
- `src/app/artist/[id]/page.tsx`
- `src/components/artist-hero.tsx` (server component, props `{ artist, standing, period }`)
- `src/components/sync-button.tsx` (`"use client"`, POST `/api/sync`, spinner, refresh)
Imports allowed: A1 queries, A2 auth, A6 table/tabs, A8 `FollowButton`? **No** — follow
buttons live inside A6's table. Use A7 badges? no. Use A10 `FanCardShare`, A9
`getActiveChallenges`, `@/components/ui`, `@/lib/period`.

### A6 — artist leaderboard API + table
- `src/components/period-tabs.tsx` (`"use client"` or link-based server component; props
  `{ period, basePath, query?: Record<string,string> }`; renders Week/Month/Year links that
  preserve other query params)
- `src/components/leaderboard-table.tsx` (`"use client"`; props
  `{ rows: LeaderboardRow[]; meId: string | null; artistId: string; period: Period }`;
  renders top-3 podium treatment plus rows; follow/unfollow button per row calling
  `/api/follow`; gold/silver/bronze; your row pinned/highlighted; badges chips; empty state)
- `src/app/api/leaderboard/route.ts`
Imports allowed: A1 `getArtistLeaderboard`, A2 `getSession`, `@/components/ui`,
`@/lib/period`, `@/lib/types`.

### A7 — badges + streaks + profile
- `src/lib/badges.ts`
- `src/lib/streaks.ts`
- `src/app/me/page.tsx`
- `src/components/badge-grid.tsx` (icon mapping for the fixed icon set + tier styling)
- `src/components/streak-strip.tsx`
Imports allowed: `@/lib/db`, `@/lib/types`, `@/lib/period`, A1 `getUserProfile`, A2 auth,
`@/components/ui`. Badge awarding rules: first-blood (first user to 100 points on an
artist), streak-7 / streak-30 (current streak), top-1 (weekly top 1% for an artist, min 20
fans), crate-digger (40 distinct track plays in one week for one artist), night-owl (50
plays 00:00–05:00 UTC for one artist; use `plays.played_at`), rivalry (any `overtake`
event where actor is this user), challenger (any completed challenge entry).

### A8 — friends + rivalries
- `src/lib/friends.ts`
- `src/app/friends/page.tsx`
- `src/components/rivalry-list.tsx`
Imports allowed: `@/lib/db`, `@/lib/types`, `@/lib/period`, A1 queries, A2 auth, A9
`logEvent`, `@/components/ui`. Page: friends leaderboard tabs (all artists / your top
artist) reusing A6 `PeriodTabs` and A1 `getFriendsLeaderboard`; rivalry cards from
`getRivalries`; "find rivals" section suggesting top fans from your best artist with follow
buttons hitting `/api/follow`; empty states.

### A9 — activity + challenges
- `src/lib/activity.ts`
- `src/lib/challenges.ts`
- `src/app/activity/page.tsx`
- `src/app/api/feed/route.ts`
- `src/app/api/challenges/[id]/join/route.ts`
- `src/components/activity-feed.tsx` (`"use client"`, polls `/api/feed` every 20s, scope
  toggle, pause when tab hidden)
- `src/components/challenge-grid.tsx` (`"use client"`, progress bars, join button
  POST `/api/challenges/[id]/join`, refresh)
Imports allowed: `@/lib/db`, `@/lib/types`, `@/lib/period`, A2 auth, A7 `BADGE_DEFS`? no —
granting the challenger badge is A7's job; challenges may insert `user_badges` for
`challenger` directly. `@/components/ui`.

### A10 — shareable card + readme
- `src/app/api/card/[artistId]/route.tsx`
- `src/components/fan-card-share.tsx` (`"use client"`, props
  `{ artistId: string; artistName: string; period: Period; rank: number | null; points: number }`;
  buttons: copy image link, open image, native share when available; uses absolute URL from
  `NEXT_PUBLIC_APP_URL`)
- `README.md` (setup, env vars, Spotify app notes, Turso swap, demo login, scripts, feature
  tour, scoring rules)
Imports allowed: `@/lib/db`, `@/lib/types`, `@/lib/period`, A2 auth. `ImageResponse` from
`next/og`. Card design: ink background, lime rank numeral, artist name in display font,
fan handle/avatar monogram, "FANRANK" wordmark, period label. Must not require external
fonts or images at request time. Return `Content-Type: image/png` with long cache headers.
If the user is not signed in or unranked, still render a valid card with `—` rank and
"UNRANKED".

## 10. Output format (mandatory)

Return ONLY complete files, each in this exact envelope, no prose before/after:

```
=== FILE: src/lib/example.ts ===
<full file contents>
=== END FILE ===
```

Rules: one envelope per file; no markdown fences around contents; every file complete and
importable; no ellipses; no `...` placeholders; no commentary. If a file already exists per
this contract, output the full replacement. Never output files outside your ownership list.
Quality bar: `tsc --noEmit` and `next build` must pass. Prefer straightforward SQL and
explicit null checks over clever abstractions.
