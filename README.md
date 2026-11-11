# Ultfave

Who really runs the fandom? Ultfave turns your Spotify listening into per-artist leaderboards:
weekly, monthly and yearly rankings, streaks, badges, rivalries and a shareable PNG fan card.

Late-night stadium scoreboard aesthetic: near-black, oversized numerals, lime accent, mono metadata.
Dark mode only. All data stays in your own database.

## Requirements

- Node.js 20.9 or newer
- npm (ships with Node)
- Optional: a Spotify developer app, and a Turso account for hosted libSQL

## Install

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run db:migrate           # create tables (local file db by default)
npm run db:seed              # 6 artists, 49 fans, 120 days of scores, badges, challenges
npm run dev                  # http://127.0.0.1:3000
```

No `.env.local` is required to boot: the app falls back to `file:local.db` and a dev session secret.

## Environment variables (`.env.local`)

| Key | Required | Purpose |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | no | libSQL URL. Default `file:local.db`; use `libsql://<db>-<org>.turso.io` for Turso |
| `TURSO_AUTH_TOKEN` | no | Turso auth token; leave empty for a local file |
| `SESSION_SECRET` | recommended | HS256 key for the `ultfave_session` cookie. Generate: `openssl rand -hex 32` |
| `SPOTIFY_CLIENT_ID` | for Spotify login | Spotify app client id |
| `SPOTIFY_CLIENT_SECRET` | for Spotify login | Spotify app client secret |
| `SPOTIFY_REDIRECT_URI` | no | Defaults to `http://127.0.0.1:3000/api/auth/spotify/callback` |
| `CRON_SECRET` | for cron | Secret for `GET /api/cron/sync` |
| `NEXT_PUBLIC_APP_URL` | recommended | Absolute base URL used in share links, e.g. `http://127.0.0.1:3000` |

Generate a Turso token with `turso db tokens create <db-name>`. Never commit `.env.local`.

## Two ways to log in

- **Demo fan (no Spotify needed).** `POST /api/auth/demo` signs you in as `demo-you`
  ("Rohan", `@rohan`) against the fictional seeded universe. The login page always exposes this.
- **Spotify.** `GET /api/auth/spotify` runs the OAuth code flow, upserts the user by Spotify id,
  stores tokens, and kicks off a background sync. The button only appears when
  `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are set.

Demo users have no Spotify tokens; only real Spotify accounts can be synced.

## Spotify developer app notes

1. Create an app at <https://developer.spotify.com/dashboard>.
2. In **Settings -> Redirect URIs**, add the exact URI you put in `SPOTIFY_REDIRECT_URI`.
   Spotify rejects `localhost`; use the loopback IP form `http://127.0.0.1:3000/api/auth/spotify/callback`.
3. While the app is in **Development mode**, only accounts added under
   **User Management** (up to 25) can authorize it. Add every tester's Spotify account email,
   or request an extension from Spotify for more seats.
4. Scopes used: `user-read-recently-played`, `user-read-email`, `user-read-private`, `user-top-read`.

## Swapping local libSQL for Turso

```bash
turso db create ultfave
turso db show ultfave --url        # -> libsql://ultfave-<org>.turso.io
turso db tokens create ultfave     # -> token
```

Set both values in `.env.local`:

```bash
TURSO_DATABASE_URL=libsql://ultfave-<org>.turso.io
TURSO_AUTH_TOKEN=<token>
```

Then `npm run db:migrate` and `npm run db:seed` once against the remote database.
`src/lib/db.ts` is the only client; nothing else changes. `file:local.db` stays ignored for local work.

## Syncing plays

- `POST /api/sync` (signed-in fans) imports the latest plays for the current user.
- `GET /api/cron/sync?secret=$CRON_SECRET` syncs every non-demo user with a stored refresh token.
  A `Authorization: Bearer $CRON_SECRET` header works too. Point a daily scheduler at it, e.g. a
  `vercel.json` cron entry or any external cron service. Demo users are skipped.

Each sync refreshes the access token when needed, upserts artists/tracks/plays, recomputes daily
scores, then runs streaks, overtake detection, challenge settlement and badge evaluation. Those
post-steps are isolated: one failure never aborts the import.

## Scoring rules

Per play, capped at 8 minutes:

```
minutes = min(duration_ms, 480000) / 60000
```

Daily score for one user and one artist:

```
points = minutes + 10 * min(distinct_tracks, 20) + 5 * (plays > 0)
```

`daily_scores` is the source of truth for every leaderboard. Global artist boards rank artists by
the summed points of all their fans.

## Periods and rank deltas

- **Week**: Monday to Sunday, UTC, labelled with the ISO week key (`Week 46`).
- **Month**: calendar month, UTC.
- **Year**: calendar year, UTC.

`src/lib/period.ts` owns all period math; nothing else computes ranges. Rank deltas come from
`rank_snapshots` for the previous period: `delta = prevRank - rank`, so a positive number means the
fan moved up. Unranked last period means no delta. Ties share a rank (1 + the number of fans with
more points).

## Badges, streaks and challenges

- **Badges** (`src/lib/badges.ts`): first-blood, streak-7, streak-30, top-1, crate-digger,
  night-owl, rivalry, challenger. Evaluated after every sync; tiers are bronze, silver, gold, elite.
- **Streaks** (`src/lib/streaks.ts`): consecutive days with a scored play for an artist, tracked as
  current/longest per fan and artist.
- **Challenges** (`src/lib/challenges.ts`): weekly targets on `minutes`, `plays` or `distinct_tracks`,
  optionally scoped to one artist. Joining is idempotent; settlement grants bonus points and the
  challenger badge once the target is met.

## Shareable fan card

`GET /api/card/[artistId]?period=week|month|year` returns a 1200x630 PNG rendered with `next/og`:
lime rank numeral (or an em dash when unranked), artist name, `@handle` monogram, period points,
`ULTFAVE` wordmark. No external fonts or images are fetched at request time, so it renders anywhere.
The response is cached for 5 minutes (`Cache-Control: public, max-age=300`). Missing artists return
404; signed-out visitors get a valid, unranked card.

## Project structure

```
src/app/
  page.tsx                       home: hero, live ticker, global artist board
  artist/[id]/page.tsx           artist hero, period tabs, leaderboard, card share
  friends/page.tsx               friends board, rivalries, suggestions
  activity/page.tsx              live activity feed
  me/page.tsx                    profile: totals, badges, streaks, top artists
  login/page.tsx                 demo + Spotify login
  api/auth/...                   spotify, callback, demo, logout
  api/sync/route.ts              POST manual sync
  api/cron/sync/route.ts         GET scheduled sync
  api/leaderboard/route.ts       artist leaderboard JSON
  api/leaderboard/artists/route.ts global artist board JSON
  api/feed/route.ts              activity JSON
  api/follow/route.ts            follow / unfollow
  api/challenges/[id]/join/route.ts
  api/card/[artistId]/route.tsx  shareable PNG card
  globals.css, layout.tsx
src/components/                  site nav, tables, tabs, cards, feeds, forms
src/lib/                         db, schema.sql, types, period, auth, spotify, ingest,
                                 queries, badges, streaks, friends, activity, challenges
scripts/migrate.mjs              applies src/lib/schema.sql
scripts/seed.mjs                 deterministic fictional demo universe
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Apply `src/lib/schema.sql` (idempotent) |
| `npm run db:seed` | Reset demo rows and reseed; deterministic, safe to rerun |

## Known limitations

- Demo artists, fans, plays and activity are **fictional** and generated for this build.
- Spotify's recently-played endpoint returns at most **50 tracks** (~the last 24 hours), so point
  totals only reflect what that window exposes; sync regularly to avoid gaps.
- The activity feed **polls** every 20 seconds (pauses on hidden tabs). There are no websockets.
- Ranks are recomputed on request, not streamed; cached cards can trail live data by up to 5 minutes.
- Dark mode only. No email/password accounts; identity is a Spotify account or the demo fan.
