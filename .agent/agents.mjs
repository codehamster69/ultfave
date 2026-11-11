export const agents = [
  {
    id: "a1",
    title: "Data core: queries + demo seed",
    files: ["src/lib/queries.ts", "scripts/seed.mjs"],
    brief: `You own the analytical heart of FanRank. Implement src/lib/queries.ts exactly per the contract signatures, reading daily_scores for period ranges from periodRange(). All leaderboards are computed live from daily_scores (no cache tables). Convert rows to camelCase via SQL aliases. For each leaderboard: rank by points desc, minutes desc, user id for stability; previous-period ranks come from a second aggregation over [prevStart, prevEnd] merged in JS; delta = prevRank - rank (null if unranked before). Friend flags: EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followee_id = u.id). Attach up to 3 badges per user via one follow-up query over user_badges JOIN badges, not per-row queries. Always append the viewer row to getArtistLeaderboard even when outside limit. getGlobalArtistLeaderboard: sum points over fans, count distinct fans with points > 0, and fetch each artist's top fan (one query per artist is acceptable for limit <= 20); include prev-period rank for delta. getUserProfile: user, badges, streaks with artist names/images, top 3 artists this month with rank computed among that artist's fans, totals (points/minutes/plays/artists for the year). Never throw on empty tables; return [] or null.

scripts/seed.mjs is plain ESM JS using @libsql/client directly (same env vars as src/lib/db.ts). It must be idempotent: delete all rows for is_demo users, the six known artist ids, the eight badge ids, three challenge ids, and demo activity/snapshots first; then insert everything the contract lists. Use a deterministic LCG so runs are stable. Generate 120 days of daily_scores for 48 fans across 2-4 artists each (weekend boost, some zero days), with numbers that look believable; give demo-you strong but not always #1 totals across 4 artists so weekly/monthly/all-time boards differ. Insert data with batched statements (chunk 400). Create rank_snapshots for the previous week and previous month for demo-you plus the top 20 fans per artist so deltas are non-null. Add recent plays only for the last 7 days for the top 10 fans. Badge rows must match the exact ids/names/icons/tiers in the contract. Challenges must use this week's Monday-Sunday dates computed in UTC. End by printing a summary (counts) and closing the client.`,
  },
  {
    id: "a2",
    title: "Auth: Spotify OAuth + demo sessions",
    files: [
      "src/lib/auth.ts",
      "src/app/login/page.tsx",
      "src/app/api/auth/spotify/route.ts",
      "src/app/api/auth/spotify/callback/route.ts",
      "src/app/api/auth/demo/route.ts",
      "src/app/api/auth/logout/route.ts",
    ],
    brief: `Implement cookie sessions with jose (HS256, 30 days, httpOnly, sameSite lax, secure in production, cookie name fanrank_session). getSession verifies the JWT and returns SessionUser or null; use React cache() to dedupe within a request. requireUser redirects to /login. setSession and clearSession must be called only from route handlers (cookies() is async in Next 15). Never expose tokens in the session payload.

Spotify OAuth: /api/auth/spotify sets an httpOnly state cookie (randomUUID, 10 min, path /) and redirects to getAuthorizeUrl(state); if not configured, redirect to /login?error=spotify_not_configured. The callback validates the state cookie (clear it), exchanges the code, upserts the user by spotify_id (id sp_<spotifyId>, unique handle slug from the display name plus a short suffix on collision), stores access/refresh tokens and expiry, sets the session, kicks off syncUserPlays without awaiting it (catch errors), and redirects to /me?welcome=1. Handle Spotify denial (?error=access_denied) and failures by redirecting to /login?error=... with a short code.

Demo route: find user demo-you; if missing, insert a minimal demo user (id demo-you, display_name Rohan, handle rohan, is_demo 1) and set the session; POST only; redirect /me. Logout clears and redirects /.

Login page: dark premium split layout, headline like "PROVE YOU'RE THE TOP FAN", 3 bullet points on scoring, big "Enter as demo fan" form button (POST /api/auth/demo), Spotify button (link to /api/auth/spotify) enabled only when isSpotifyConfigured(), with a short muted note when not configured explaining SPOTIFY_CLIENT_ID/SECRET are needed, and an error banner driven by the error searchParam. Also note the app works fully on fictional demo data. Use only @/components/ui primitives if useful; no emoji.`,
  },
  {
    id: "a3",
    title: "App shell, home page, global artist board",
    files: [
      "src/components/site-nav.tsx",
      "src/components/ui.tsx",
      "src/app/page.tsx",
      "src/app/api/leaderboard/artists/route.ts",
    ],
    brief: `Build src/components/ui.tsx first: Avatar (monogram with deterministic hue from name, optional real image via plain <img> with sizes; sizes 28/36/48/64; lime ring option), StatCard, SectionHeader, EmptyState, Delta (green up arrow for positive, muted dash for 0/null, magenta down for negative; no emoji, inline SVG). Server-safe; only mark "use client" if a primitive truly needs state.

SiteNav: sticky top bar with subtle blur and border, brand "FANRANK" in display font with a lime slash mark, links Home, Friends, Activity, Me; right side shows Sign in (link /login) or avatar + name + a POST form to /api/auth/logout. Mobile: horizontally scrollable links, compact. Reads getSession().

Home page: hero with eyebrow "LIVE FANDOM INDEX", massive display headline "WHO REALLY RUNS THE FANDOM?", supporting copy, two CTAs (Explore artists → #artists, Enter as demo fan → /login). Platform stat strip computed with 3 simple aggregate queries via @/lib/db (fans, artists, points awarded this week) — this is the only home-page DB access allowed. Live ticker from getFeed(null, "global", 8) that renders recent events in a horizontally scrolling strip with a pulsing live dot. Then #artists section: SectionHeader + PeriodTabs (import from @/components/period-tabs) + global artist leaderboard using getGlobalArtistLeaderboard(period, 20). Each row: rank with delta, artist monogram, name, genres, fan count, top fan, big points number, link to /artist/[id]; first three rows get gold/silver/bronze accents. Add a "How points work" 3-card section (minutes, distinct tracks, streaks). Empty state if no artists. Keep the page an async server component reading searchParams (async in Next 15) and validate with isPeriod.

/api/leaderboard/artists: GET, validate period with isPeriod, return { ok: true, period, rows }. dynamic = "force-dynamic".`,
  },
  {
    id: "a4",
    title: "Spotify ingest, scoring, sync routes",
    files: [
      "src/lib/spotify.ts",
      "src/lib/ingest.ts",
      "src/app/api/sync/route.ts",
      "src/app/api/cron/sync/route.ts",
    ],
    brief: `Implement Spotify Web API helpers with fetch and no SDK: authorize URL (scope user-read-recently-played user-read-email user-read-private user-top-read), token exchange and refresh via Basic auth, profile, recently-played mapping (items[].track, album.images[0].url, duration_ms, artist id/name, played_at). Use SPOTIFY_CLIENT_ID/SECRET/REDIRECT_URI with defaults; isSpotifyConfigured requires id+secret. Throw descriptive errors on non-2xx.

syncUserPlays: load the user's tokens; refresh when expiring within 60s and persist (expires_at epoch seconds); fetch recently played (limit 50); upsert artists (INSERT OR IGNORE with followers 0 and genres []), tracks (INSERT OR REPLACE with duration), and plays. Points per play = minutes capped at 8. Use INSERT OR IGNORE relying on UNIQUE(user_id, track_id, played_at) and count actual inserts (compare rowsAffected or query before). Group affected artist/day pairs, then recomputeDailyScore for each: delete nothing; recompute by aggregating plays for that user/artist/day into daily_scores with the frozen formula (minutes + 10*min(distinct,20) + 5 if plays>0) using INSERT ... ON CONFLICT DO UPDATE. Then per affected artist call awardStreakDay(user, artist, day) (for each affected day) inside try/catch, call detectOvertakes(userId, artistId, pointsAddedForThatArtist) inside try/catch, then settleChallenges and evaluateBadges once each in try/catch. Update users.last_synced_at. Return { imported, points }. If no tokens or not configured return { imported: 0, points: 0, error } without throwing.

POST /api/sync: session required (401 JSON if absent), call syncUserPlays, return ok payload. GET /api/cron/sync: require secret query or bearer equal to CRON_SECRET (401 otherwise); select non-demo users with refresh tokens; sync sequentially, count successes; return { ok, synced, failed }. Set runtime = "nodejs" and dynamic force-dynamic.`,
  },
  {
    id: "a5",
    title: "Artist page",
    files: [
      "src/app/artist/[id]/page.tsx",
      "src/components/artist-hero.tsx",
      "src/components/sync-button.tsx",
    ],
    brief: `Artist page (async server component): params and searchParams are Promises in Next 15. Load getArtist(id) (notFound() when missing), session, validated period (default week), getArtistLeaderboard(id, period, user?.id ?? null, 50), and getUserArtistStanding for the signed-in user. Render ArtistHero, a "your standing" panel (rank / total fans, points, delta, CTA to sync via SyncButton, FanCardShare from @/components/fan-card-share with artistId, artistName, period, rank, points), then the leaderboard section with PeriodTabs (basePath /artist/[id]) and LeaderboardTable from A6. Add a compact "this week's challenges" strip using getActiveChallenges(session?.id ?? null) filtered to this artist or global, linking to /activity. Also show a "next rival above you" hint (the row directly above the viewer) and 3 artist stat cards (fans, points this period, top fan). If signed out, show a join CTA to /login instead of standing.

ArtistHero: server component, large gradient panel with oversized artist name in font-display, genre chips, follower count, artist monogram (no external image required), subtle scoreboard grid lines, and a decorative huge rank number optional. Keep it responsive and dark.

SyncButton: "use client"; props { label?: string; className?: string }; POST /api/sync, disabled+spinner while running, then router.refresh(); on error show a small inline message. No emoji.`,
  },
  {
    id: "a6",
    title: "Artist leaderboard API + interactive table",
    files: [
      "src/components/period-tabs.tsx",
      "src/components/leaderboard-table.tsx",
      "src/app/api/leaderboard/route.ts",
    ],
    brief: `PeriodTabs: a server component (no hooks) that renders three links Week / Month / Year for basePath plus query params. Props exactly { period: Period; basePath: string; query?: Record<string, string> } — build hrefs with URLSearchParams preserving query but overriding period. Active tab uses lime background, ink text; inactive uses panel border and muted text. Compact pill group, accessible aria-current.

LeaderboardTable: "use client". Props { rows: LeaderboardRow[]; meId: string | null; artistId: string; period: Period }. Render a top-3 podium (three cards, #1 tallest, gold/silver/bronze accents, big points, avatar, name, handle, medal numeral) followed by a dense list for the rest (rank, delta, avatar, name+handle with a "YOU" chip, up to 2 badge chips, minutes, points, follow button). Follow button calls POST /api/follow with { userId, action }, toggles local state from row.isFriend, disables while pending, and hides for meId. Highlight and pin the viewer row (use rows as-is; A1 already appends the viewer). Empty state when no rows. Sort-safe: don't re-sort, trust A1. Format numbers with formatPoints/formatMinutes. Responsive: on mobile hide minutes/played columns, keep rank, fan, points.

/api/leaderboard: GET with artistId required, period validated (default week), limit clamped 1-100 (default 50). Session optional. Return { ok, period, rows, me } where me is the viewer's row from the list or null. dynamic force-dynamic.`,
  },
  {
    id: "a7",
    title: "Badges, streaks, profile page",
    files: [
      "src/lib/badges.ts",
      "src/lib/streaks.ts",
      "src/app/me/page.tsx",
      "src/components/badge-grid.tsx",
      "src/components/streak-strip.tsx",
    ],
    brief: `badges.ts: export BADGE_DEFS with the exact 8 ids/names/icons/tiers from the contract and stable rule strings. ensureBadges() upserts definitions (INSERT OR REPLACE). evaluateBadges(userId) recomputes eligibility with efficient SQL (one or two queries per badge is fine at this scale), inserts OR IGNORE into user_badges with artist_id = '' for global badges (or the specific artist for first-blood/top-1/streak badges where relevant), and for each newly earned row inserts an activity event directly (kind 'badge', actor_id user, artist_id when applicable, message "Rohan earned Inner Circle on Nova Kestrel", meta JSON with badgeId). Rules: first-blood = first user to reach 100 points on any artist (check MIN(day) reaching 100); streak-7 / streak-30 from streaks.current; top-1 = top 1% weekly for an artist with >=20 fans; crate-digger = 40 distinct tracks in one ISO week for one artist using plays; night-owl = 50 plays 00:00-05:00 UTC for one artist; rivalry = existing activity_events kind 'overtake' with actor_id = user; challenger = any completed challenge entry. Return the newly earned UserBadge[] (artistName joined). getUserBadges returns all with artist names, tier, earnedAt sorted newest first.

streaks.ts: awardStreakDay(user, artist, day) — compute current streak for that artist from consecutive days ending at the given day (query DISTINCT days desc, walk in JS), keep longest = max(existing.longest, current), upsert; ignore no-op days older than last_day. getUserStreaks(user, limit) joins artists and orders by current desc.

Profile page /me: requireUser(); getUserProfile(user.id); if null redirect /login. Header with Avatar, display name, @handle, demo chip, and SyncButton (import from @/components/sync-button). Stat cards: points this week, minutes this week, artists this year, longest active streak. Top artists list with rank and points and links. StreakStrip and BadgeGrid components. CTAs to /friends and /activity. Empty states for new users. Components are server-safe and take the contract types. BadgeGrid maps icon names to inline SVGs (bolt, flame, crown, disc, moon, swords, trophy, target) and tier to accent color.`,
  },
  {
    id: "a8",
    title: "Friends, rivalries, follow API",
    files: ["src/lib/friends.ts", "src/app/friends/page.tsx", "src/components/rivalry-list.tsx"],
    brief: `friends.ts: followUser/unfollowUser/isFollowing via follows table (INSERT OR IGNORE / DELETE). getRivalries(viewerId, period): load the viewer's followees, their points per artist for the period from daily_scores; for each friend, choose the shared artist (both have points) with the highest combined points; if none, fall back to all-artist totals with artistId null. Return myPoints, theirPoints, diff = mine - theirs, ahead = diff > 0, sorted by absolute diff desc, limit 12. detectOvertakes(userId, artistId, pointsAdded): if pointsAdded <= 0 return; for each friend, compare today's points (before = current - pointsAdded for this user, friendPoints = friend's today total); when before <= friendPoints and current > friendPoints, insert an activity event kind 'overtake' with actor, artist, targetUser, message "<actor> just overtook <friend> on <artist>", meta with points. Avoid duplicates: skip if an identical overtake event exists for the actor/friend/artist today.

Friends page: async server, requireUser(), period from searchParams, getFriendsLeaderboard(viewerId, null, period, 50), getRivalries(viewerId, period), and suggestions: the viewer's best artist this period (highest points in daily_scores) and its top fans excluding self and existing followees, limit 5. Layout: SectionHeader, PeriodTabs (basePath /friends), two-column grid on desktop: friends leaderboard table-like list (reuse LeaderboardTable? No — build a compact list) and RivalryList, then "Find rivals" suggestions with follow buttons. Empty states with clear copy when not following anyone yet.

RivalryList: "use client" for follow/unfollow buttons; props { rivalries, viewerName }. Cards showing avatar, name, shared artist, two point numbers with a visual bar (you vs them), diff label ("you lead by 12" / "behind by 8"), follow toggle hitting /api/follow then router.refresh(). No emoji.`,
  },
  {
    id: "a9",
    title: "Activity feed, challenges, APIs",
    files: [
      "src/lib/activity.ts",
      "src/lib/challenges.ts",
      "src/app/activity/page.tsx",
      "src/app/api/feed/route.ts",
      "src/app/api/challenges/[id]/join/route.ts",
      "src/components/activity-feed.tsx",
      "src/components/challenge-grid.tsx",
    ],
    brief: `activity.ts: logEvent inserts an activity row with randomUUID id and meta JSON.stringify, clamped message length 280. getFeed(viewerId, scope, limit): global returns latest events; friends returns events where actor_id = viewer OR actor_id IN (SELECT followee_id FROM follows WHERE follower_id = viewer) OR target_user_id = viewer. Join users (actor) and artists for display fields, return ActivityEvent[] newest first, clamp limit 1-50.

challenges.ts: getActiveChallenges(viewerId) returns challenges overlapping today (starts_on <= today <= ends_on) with participant counts, joined/completed flags and computed progress for the viewer. Progress: sum over daily_scores between starts_on and ends_on (optionally artist filter); for metric distinct_tracks sum distinct_tracks. joinChallenge: insert OR IGNORE entry; if the challenge does not exist or is over return an error; log a 'join' activity event. settleChallenges(userId): for joined non-completed active-or-just-ended challenges, if progress >= target mark completed_at, insert user_badges ('challenger','',user) OR IGNORE, add bonus points to the user's daily_scores row for the challenge artist (or the user's highest-point artist that period when artist is NULL) today, upserting, and log a 'challenge' event. Idempotent: only when completed_at IS NULL.

Activity page: async server with searchParams scope (global|friends, default global) and session. Header "THE FANDOM NEVER SLEEPS" with a live dot, scope toggle links, ActivityFeed and ChallengeGrid side by side on desktop. Signed-out users can view global and are prompted to sign in to join.

ActivityFeed: "use client", props { initialEvents, scope, viewerId }. Poll GET /api/feed?scope=&limit=30 every 20s, pause when document.hidden, show relative times via timeAgo, icons per kind (milestone, badge, overtake, challenge, join) as inline SVGs, live dot, "updated Xs ago" status, graceful error state.

ChallengeGrid: "use client", props { challenges, viewerId }. Cards with metric label, progress bar (lime when complete), target, bonus points chip, participants, artist name, ends date, join CTA POST /api/challenges/[id]/join then router.refresh(); show completed state. Empty state.

/api/feed: GET scope/limit with validation, session optional, { ok, events }. /api/challenges/[id]/join: POST, auth required (401), await params, call joinChallenge, return { ok } or error. dynamic force-dynamic.`,
  },
  {
    id: "a10",
    title: "Shareable fan card + README",
    files: [
      "src/app/api/card/[artistId]/route.tsx",
      "src/components/fan-card-share.tsx",
      "README.md",
    ],
    brief: `Card route: GET 1200x630 PNG with ImageResponse from next/og. Params are async (Next 15), searchParams async. Load artist from artists; load session (optional); when signed in compute the viewer's rank and points for the artist/period via the same aggregation used by leaderboards (points from daily_scores in periodRange; rank = 1 + count of users with more points). Design with inline styles only (satori): flex layouts, no grid, no external fonts/images. Ink background with two radial-ish accent blocks (use absolute divs with borderRadius), giant rank numeral in lime (or "—" when unranked), "#<rank> <ARTIST NAME> FAN" headline, @handle, points in mono, week/month/year label, FANRANK wordmark, "fanrank.app" footer text. Handle missing artist with a 404 Response. Cache-Control public, max-age 300. runtime = "nodejs", dynamic force-dynamic.

FanCardShare: "use client", props exactly { artistId, artistName, period, rank, points }. Build cardUrl from NEXT_PUBLIC_APP_URL (fallback window.location.origin) + "/api/card/" + artistId + "?period=" + period. Buttons: Copy card link (clipboard, "Copied" feedback for 2s), Open card (new tab), Share (navigator.share when available, else copy fallback). Show a compact preview strip with rank and points. Disable/annotate when rank is null ("Sync to get ranked"). No emoji, no external deps.

README.md: precise setup for this repo: requirements, npm install, .env.local keys (SESSION_SECRET, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, SPOTIFY_*), npm run db:migrate, npm run db:seed, npm run dev. Explain demo login vs Spotify login, Spotify Development-mode allowlist and redirect URI, how to swap local libSQL for Turso (create db, get URL/token, env), the scheduled sync endpoint, scoring rules, badges/streaks/challenges, leaderboard periods and rank deltas, project structure, scripts, and known limitations (demo data fictional, recently-played window of 50 tracks, polling instead of websockets). Concise, skimmable, no fluff.`,
  },
];
