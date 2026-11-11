import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const db = createClient({ url, authToken });

/* ---------------------------------------------------------------------------
 * Date helpers (all UTC day keys, stored as ISO strings)
 * ------------------------------------------------------------------------- */

const DAY_MS = 86_400_000;

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(day, delta) {
  return dayKey(new Date(new Date(`${day}T00:00:00.000Z`).getTime() + delta * DAY_MS));
}

function weekday(day) {
  return new Date(`${day}T00:00:00.000Z`).getUTCDay();
}

function at(day, hour, minute = 0) {
  return new Date(
    `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`,
  ).toISOString();
}

function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const round2 = (n) => Math.round(n * 100) / 100;
const pairKey = (a, b) => `${a}|${b}`;

const TODAY = dayKey(new Date());

/* ---------------------------------------------------------------------------
 * Deterministic RNG (LCG) so every reseed produces identical data
 * ------------------------------------------------------------------------- */

let rngState = 0x2f6f2b1d;
function rnd() {
  rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
  return rngState / 4294967296;
}
function rndInt(min, max) {
  return min + Math.floor(rnd() * (max - min + 1));
}
function pick(list) {
  return list[Math.floor(rnd() * list.length)];
}

/* ---------------------------------------------------------------------------
 * Static demo universe
 * ------------------------------------------------------------------------- */

const ARTISTS = [
  {
    id: "nova-kestrel",
    name: "Nova Kestrel",
    genres: ["synthpop", "dream pop", "stadium wave"],
    followers: 1284000,
    weight: 1.0,
  },
  {
    id: "midnight-arcade",
    name: "Midnight Arcade",
    genres: ["synthwave", "electro", "dark disco"],
    followers: 864000,
    weight: 0.9,
  },
  {
    id: "lila",
    name: "LILA",
    genres: ["alt r&b", "soul", "art pop"],
    followers: 2140000,
    weight: 1.15,
  },
  {
    id: "paper-satellites",
    name: "The Paper Satellites",
    genres: ["indie rock", "shoegaze"],
    followers: 542000,
    weight: 0.72,
  },
  {
    id: "jonah-vale",
    name: "Jonah Vale",
    genres: ["singer-songwriter", "folk", "ambient"],
    followers: 318000,
    weight: 0.62,
  },
  {
    id: "kaiju-club",
    name: "KAIJU CLUB",
    genres: ["hyperpop", "electronic", "club"],
    followers: 1790000,
    weight: 1.05,
  },
];

const ARTIST_BY_ID = new Map(ARTISTS.map((artist) => [artist.id, artist]));
const ARTIST_IDS = ARTISTS.map((artist) => artist.id);

const TRACK_NAMES = {
  "nova-kestrel": ["Neon Cathedral", "Static Bloom", "Half-Light Run", "Signal Fire"],
  "midnight-arcade": ["Coin Slot Heart", "Afterglow Arcade", "Pixel Saint", "Quarter Past Never"],
  lila: ["Velvet Static", "Honey Bruise", "Slow Burn Saint", "Golden Hour Riot"],
  "paper-satellites": ["Paper Sky", "Telegram To The Moon", "Antenna Season", "Quiet Orbit"],
  "jonah-vale": ["Pine And Petrol", "Letters From The Ferry", "Copper Line", "Winter Orchard"],
  "kaiju-club": ["Kaiju Club Anthem", "Titanium Sugar", "Monster Mash", "Riot Bloom"],
};

const FAN_NAMES = [
  ["Maya Okonkwo", "mayapulse"],
  ["Diego Ferreira", "diegofv"],
  ["Hana Sato", "hanasato"],
  ["Elias Berg", "eliasberg"],
  ["Priya Raman", "priyaraman"],
  ["Noah Lindqvist", "noahlq"],
  ["Amara Diallo", "amarad"],
  ["Tobias Krause", "tobik"],
  ["Sofia Marchetti", "sofiamarch"],
  ["Kenji Mori", "kenjimori"],
  ["Leila Haddad", "leilahaddad"],
  ["Mateo Alvarez", "mateoalv"],
  ["Zara Iqbal", "zaraq"],
  ["Finn O'Doherty", "finnod"],
  ["Nia Mwangi", "niamwangi"],
  ["Lucia Romano", "luciaromano"],
  ["Owen Park", "owenpark"],
  ["Ada Kowalski", "adakow"],
  ["Ravi Menon", "ravimenon"],
  ["Elena Petrova", "elenapetrova"],
  ["Sam Okafor", "samokafor"],
  ["Yuki Tanaka", "yukitanaka"],
  ["Clara Dubois", "claradubois"],
  ["Andre Silva", "andresilva"],
  ["Ines Costa", "inescosta"],
  ["Miro Novak", "mironovak"],
  ["Thandi Nkosi", "thandin"],
  ["Lucas Meyer", "lucasmeyer"],
  ["Farah Aziz", "farahaziz"],
  ["Oscar Lindgren", "oscarlind"],
  ["Bianca Rossi", "biancarossi"],
  ["Kwame Mensah", "kwamemensah"],
  ["Ayla Demir", "aylademir"],
  ["Hugo Martins", "hugomartins"],
  ["Sana Qureshi", "sanaq"],
  ["Leo Fischer", "leofischer"],
  ["Meera Nair", "meeranair"],
  ["Jonas Weber", "jonasweber"],
  ["Camila Reyes", "camilareyes"],
  ["Theo Laurent", "theolaurent"],
  ["Aisha Bello", "aishabello"],
  ["Nikola Horvat", "nikolah"],
  ["Rin Nakamura", "rinnakamura"],
  ["Marcus Hale", "marcushale"],
  ["Esme Visser", "esmevisser"],
  ["Daniyar Abenov", "daniyarab"],
  ["Greta Solberg", "gretasolberg"],
  ["Rafael Duarte", "rafaduarte"],
];

const BADGES = [
  {
    id: "first-blood",
    name: "First Blood",
    description: "First fan to 100 points on an artist",
    icon: "bolt",
    tier: "bronze",
    rule: "bronze: be the first fan to reach 100 points on an artist",
  },
  {
    id: "streak-7",
    name: "Seven Day Fuse",
    description: "Seven straight days of listening to one artist",
    icon: "flame",
    tier: "silver",
    rule: "silver: hold a 7-day listening streak on one artist",
  },
  {
    id: "streak-30",
    name: "Unbroken",
    description: "Thirty straight days with the same artist",
    icon: "flame",
    tier: "gold",
    rule: "gold: hold a 30-day listening streak on one artist",
  },
  {
    id: "top-1",
    name: "Inner Circle",
    description: "Ranked first among an artist's fans",
    icon: "crown",
    tier: "elite",
    rule: "elite: finish a period ranked first for an artist with at least 20 fans",
  },
  {
    id: "crate-digger",
    name: "Crate Digger",
    description: "Forty different tracks from one artist in a week",
    icon: "disc",
    tier: "silver",
    rule: "silver: play 40 distinct tracks by one artist in a single week",
  },
  {
    id: "night-owl",
    name: "Night Owl",
    description: "Fifty late-night plays for one artist",
    icon: "moon",
    tier: "bronze",
    rule: "bronze: log 50 plays between 00:00 and 05:00 UTC for one artist",
  },
  {
    id: "rivalry",
    name: "Rivalry",
    description: "Overtook a friend on an artist leaderboard",
    icon: "swords",
    tier: "bronze",
    rule: "bronze: overtake a friend on an artist leaderboard",
  },
  {
    id: "challenger",
    name: "Challenger",
    description: "Completed a weekly challenge",
    icon: "trophy",
    tier: "gold",
    rule: "gold: complete a weekly challenge and claim the bonus",
  },
];

const BADGE_IDS = BADGES.map((badge) => badge.id);
const CHALLENGE_IDS = ["challenge-nova-sprint", "challenge-deep-cuts", "challenge-global-grind"];

/* ---------------------------------------------------------------------------
 * Users: fixed demo-you plus 48 demo fans
 * ------------------------------------------------------------------------- */

const users = [];

users.push({
  id: "demo-you",
  name: "Rohan",
  handle: "rohan",
  isDemo: 1,
  strength: 1.13,
  recent: 1.1,
  early: 0.99,
  missRate: 0.08,
  artists: ["nova-kestrel", "midnight-arcade", "lila", "kaiju-club"],
  affinity: {
    "nova-kestrel": 1.16,
    "midnight-arcade": 1.03,
    lila: 1.0,
    "kaiju-club": 1.05,
  },
  createdAt: at(addDays(TODAY, -240), 9, 30),
});

function chooseArtists() {
  const wanted = rndInt(2, 4);
  const pool = ARTISTS.map((artist) => ({ id: artist.id, weight: artist.weight }));
  const chosen = [];
  while (chosen.length < wanted && pool.length > 0) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rnd() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i += 1) {
      roll -= pool[i].weight;
      if (roll <= 0) {
        index = i;
        break;
      }
    }
    chosen.push(pool[index].id);
    pool.splice(index, 1);
  }
  return chosen;
}

FAN_NAMES.forEach(([name, handle], index) => {
  const artists = chooseArtists();
  const affinity = {};
  for (const artistId of artists) {
    affinity[artistId] = 0.84 + rnd() * 0.36;
  }
  users.push({
    id: `fan-${String(index + 1).padStart(2, "0")}`,
    name,
    handle,
    isDemo: 1,
    strength: 0.72 + rnd() * 0.5,
    recent: 0.84 + rnd() * 0.42,
    early: 0.84 + rnd() * 0.42,
    artists,
    affinity,
    createdAt: at(addDays(TODAY, -rndInt(60, 520)), rndInt(0, 23), rndInt(0, 59)),
  });
});

const USER_IDS = users.map((user) => user.id);

/* ---------------------------------------------------------------------------
 * Tracks
 * ------------------------------------------------------------------------- */

const tracks = [];
for (const artist of ARTISTS) {
  TRACK_NAMES[artist.id].forEach((name, index) => {
    tracks.push({
      id: `track-${artist.id}-${index + 1}`,
      artistId: artist.id,
      name,
      durationMs: rndInt(148000, 305000),
    });
  });
}

/* ---------------------------------------------------------------------------
 * 120 days of daily_scores
 * ------------------------------------------------------------------------- */

const dowNow = weekday(TODAY) || 7;
const mondayThisWeek = addDays(TODAY, -(dowNow - 1));
const sundayThisWeek = addDays(mondayThisWeek, 6);

const WINDOW_DAYS = 120;
const days = [];
for (let i = WINDOW_DAYS - 1; i >= 0; i -= 1) days.push(addDays(TODAY, -i));

const dayPresence = new Map();
function presence(userId, artistId) {
  const key = pairKey(userId, artistId);
  let set = dayPresence.get(key);
  if (!set) {
    set = new Set();
    dayPresence.set(key, set);
  }
  return set;
}

const dailyRows = [];

for (const user of users) {
  for (const day of days) {
    if (rnd() < (user.id === "demo-you" ? 0 : 0.04)) continue;
    const dow = weekday(day);
    const weekend = dow === 0 || dow === 6;
    const recency = day >= addDays(TODAY, -20) ? user.recent : user.early;
    for (const artistId of user.artists) {
      const missChance =
        user.id === "demo-you" && day >= mondayThisWeek
          ? 0
          : user.missRate ?? (weekend ? 0.1 : 0.19);
      if (rnd() < missChance) continue;
      const intensity =
        user.strength * recency * (weekend ? 1.28 : 1) * user.affinity[artistId];
      const plays = Math.max(1, Math.round((5 + rnd() * 9) * intensity));
      const distinct = Math.max(1, Math.min(22, Math.round(plays * (0.55 + rnd() * 0.45))));
      const minutes = round2(plays * (2.7 + rnd() * 1.5));
      const points = round2(minutes + 10 * Math.min(distinct, 20) + 5);
      dailyRows.push([user.id, artistId, day, points, minutes, plays, distinct]);
      presence(user.id, artistId).add(day);
    }
  }
}

/* ---------------------------------------------------------------------------
 * Aggregates derived from the generated scores
 * ------------------------------------------------------------------------- */

const totalPoints = new Map();
const artistUserPoints = new Map();
const monthArtistUserPoints = new Map();
const monthArtistUserDistinct = new Map();
const prevWeekArtistUserPoints = new Map();
const prevMonthArtistUserPoints = new Map();

const monthStart = `${TODAY.slice(0, 7)}-01`;
const nowDate = new Date(`${TODAY}T00:00:00.000Z`);
const prevMonthStart = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - 1, 1));
const prevMonthEnd = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 0));
const prevMonthStartDay = dayKey(prevMonthStart);
const prevMonthEndDay = dayKey(prevMonthEnd);
const prevMonthKey = `${prevMonthStart.getUTCFullYear()}-${String(
  prevMonthStart.getUTCMonth() + 1,
).padStart(2, "0")}`;

const prevWeekStart = addDays(mondayThisWeek, -7);
const prevWeekEnd = addDays(mondayThisWeek, -1);
const prevWeekKey = isoWeekKey(new Date(`${prevWeekStart}T00:00:00.000Z`));

function bump(map, key, amount) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

for (const [userId, artistId, day, points, minutes, plays, distinct] of dailyRows) {
  if (day > TODAY) continue;
  bump(totalPoints, userId, points);
  bump(artistUserPoints, pairKey(artistId, userId), points);
  if (day >= monthStart) {
    bump(monthArtistUserPoints, pairKey(artistId, userId), points);
    bump(monthArtistUserDistinct, pairKey(artistId, userId), distinct);
  }
  if (day >= prevWeekStart && day <= prevWeekEnd) {
    bump(prevWeekArtistUserPoints, pairKey(artistId, userId), points);
  }
  if (day >= prevMonthStartDay && day <= prevMonthEndDay) {
    bump(prevMonthArtistUserPoints, pairKey(artistId, userId), points);
  }
}

const usersByPoints = [...users].sort(
  (a, b) =>
    (totalPoints.get(b.id) ?? 0) - (totalPoints.get(a.id) ?? 0) || a.id.localeCompare(b.id),
);
const fansByPoints = usersByPoints.filter((user) => user.id !== "demo-you");
const topFans = fansByPoints.slice(0, 10);

function bestArtistFor(user) {
  let best = user.artists[0];
  let bestPoints = -1;
  for (const artistId of user.artists) {
    const points = artistUserPoints.get(pairKey(artistId, user.id)) ?? 0;
    if (points > bestPoints) {
      best = artistId;
      bestPoints = points;
    }
  }
  return best;
}

function topFor(map, artistId, limit = 20) {
  return users
    .map((user) => ({
      userId: user.id,
      points: map.get(pairKey(artistId, user.id)) ?? 0,
    }))
    .filter((entry) => entry.points > 0)
    .sort((a, b) => b.points - a.points || a.userId.localeCompare(b.userId))
    .slice(0, limit);
}

/* ---------------------------------------------------------------------------
 * Streaks
 * ------------------------------------------------------------------------- */

function streakFor(daysSet) {
  const sorted = [...daysSet].sort();
  let longest = 0;
  let run = 0;
  let previous = null;
  for (const day of sorted) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = day;
  }
  let cursor = TODAY;
  if (!daysSet.has(cursor)) cursor = addDays(TODAY, -1);
  let current = 0;
  while (daysSet.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return { current, longest, lastDay: sorted.length ? sorted[sorted.length - 1] : null };
}

/* ---------------------------------------------------------------------------
 * Idempotent cleanup of previous demo data
 * ------------------------------------------------------------------------- */

function inList(values) {
  return `(${values.map(() => "?").join(", ")})`;
}

async function del(sql, args = []) {
  await db.execute({ sql, args });
}

await del(
  `DELETE FROM plays WHERE user_id IN ${inList(USER_IDS)} OR artist_id IN ${inList(ARTIST_IDS)}`,
  [...USER_IDS, ...ARTIST_IDS],
);
await del(
  `DELETE FROM daily_scores WHERE user_id IN ${inList(USER_IDS)} OR artist_id IN ${inList(ARTIST_IDS)}`,
  [...USER_IDS, ...ARTIST_IDS],
);
await del(
  `DELETE FROM streaks WHERE user_id IN ${inList(USER_IDS)} OR artist_id IN ${inList(ARTIST_IDS)}`,
  [...USER_IDS, ...ARTIST_IDS],
);
await del(
  `DELETE FROM user_badges WHERE user_id IN ${inList(USER_IDS)} OR artist_id IN ${inList(ARTIST_IDS)}`,
  [...USER_IDS, ...ARTIST_IDS],
);
await del(
  `DELETE FROM follows WHERE follower_id IN ${inList(USER_IDS)} OR followee_id IN ${inList(USER_IDS)}`,
  [...USER_IDS, ...USER_IDS],
);
await del(
  `DELETE FROM challenge_entries WHERE user_id IN ${inList(USER_IDS)} OR challenge_id IN ${inList(CHALLENGE_IDS)}`,
  [...USER_IDS, ...CHALLENGE_IDS],
);
await del(`DELETE FROM challenges WHERE id IN ${inList(CHALLENGE_IDS)}`, [...CHALLENGE_IDS]);
await del(`DELETE FROM badges WHERE id IN ${inList(BADGE_IDS)}`, [...BADGE_IDS]);
await del(
  `DELETE FROM activity_events WHERE actor_id IN ${inList(USER_IDS)} OR target_user_id IN ${inList(USER_IDS)} OR id LIKE 'evt-%'`,
  [...USER_IDS, ...USER_IDS],
);
await del(
  `DELETE FROM rank_snapshots WHERE user_id IN ${inList(USER_IDS)} OR artist_id IN ${inList(ARTIST_IDS)}`,
  [...USER_IDS, ...ARTIST_IDS],
);
await del(`DELETE FROM tracks WHERE artist_id IN ${inList(ARTIST_IDS)}`, [...ARTIST_IDS]);
await del(`DELETE FROM artists WHERE id IN ${inList(ARTIST_IDS)}`, [...ARTIST_IDS]);
await del(`DELETE FROM users WHERE is_demo = 1 OR id IN ${inList(USER_IDS)}`, [...USER_IDS]);

/* ---------------------------------------------------------------------------
 * Inserts
 * ------------------------------------------------------------------------- */

async function insertMany(table, columns, rows, chunk = 400) {
  for (let start = 0; start < rows.length; start += chunk) {
    const slice = rows.slice(start, start + chunk);
    const statements = slice.map((values) => ({
      sql: `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${columns
        .map(() => "?")
        .join(", ")})`,
      args: values,
    }));
    await db.batch(statements, "write");
  }
}

await insertMany("artists", ["id", "name", "image_url", "genres", "followers", "created_at"], [
  ...ARTISTS.map((artist) => [
    artist.id,
    artist.name,
    null,
    JSON.stringify(artist.genres),
    artist.followers,
    at(addDays(TODAY, -700), 12, 0),
  ]),
]);

await insertMany(
  "users",
  ["id", "spotify_id", "display_name", "handle", "avatar_url", "country", "is_demo", "created_at"],
  users.map((user) => [
    user.id,
    null,
    user.name,
    user.handle,
    null,
    null,
    user.isDemo,
    user.createdAt,
  ]),
);

await insertMany(
  "tracks",
  ["id", "artist_id", "name", "album_image", "duration_ms"],
  tracks.map((track) => [track.id, track.artistId, track.name, null, track.durationMs]),
);

await insertMany("badges", ["id", "name", "description", "icon", "tier", "rule"], [
  ...BADGES.map((badge) => [
    badge.id,
    badge.name,
    badge.description,
    badge.icon,
    badge.tier,
    badge.rule,
  ]),
]);

await insertMany(
  "daily_scores",
  ["user_id", "artist_id", "day", "points", "minutes", "plays", "distinct_tracks"],
  dailyRows,
);

/* Follows: demo-you follows six strong fans, fans follow each other. */
const follows = [];
const followedSet = new Set();
function addFollow(followerId, followeeId, createdAt) {
  if (followerId === followeeId) return;
  const key = pairKey(followerId, followeeId);
  if (followedSet.has(key)) return;
  followedSet.add(key);
  follows.push([followerId, followeeId, createdAt]);
}

fansByPoints.slice(0, 6).forEach((fan, index) => {
  addFollow("demo-you", fan.id, at(addDays(TODAY, -(12 + index * 3)), 20, 15));
});

fansByPoints.forEach((fan, index) => {
  const count = rndInt(2, 3);
  for (let i = 0; i < count; i += 1) {
    const target = fansByPoints[(index + rndInt(1, 47)) % fansByPoints.length];
    addFollow(fan.id, target.id, at(addDays(TODAY, -rndInt(2, 80)), rndInt(8, 22), rndInt(0, 59)));
  }
  if (rnd() < 0.22) {
    addFollow(fan.id, "demo-you", at(addDays(TODAY, -rndInt(2, 80)), rndInt(8, 22), rndInt(0, 59)));
  }
});

await insertMany("follows", ["follower_id", "followee_id", "created_at"], follows);

/* Streaks for the top 15 fans (plus demo-you when in range). */
const streakUsers = usersByPoints.slice(0, 15);
const streakRows = [];
const streakByUser = new Map();
for (const user of streakUsers) {
  for (const artistId of user.artists) {
    const set = dayPresence.get(pairKey(user.id, artistId));
    if (!set) continue;
    const { current, longest, lastDay } = streakFor(set);
    if (current === 0 && longest === 0) continue;
    streakRows.push([user.id, artistId, current, longest, lastDay]);
    streakByUser.set(pairKey(user.id, artistId), { current, longest });
  }
}
await insertMany(
  "streaks",
  ["user_id", "artist_id", "current", "longest", "last_day"],
  streakRows,
);

/* User badges derived from the same generated history. */
const userBadges = [];
const userBadgeSet = new Set();
function addBadge(userId, badgeId, artistId, earnedAt) {
  const key = `${userId}|${badgeId}|${artistId}`;
  if (userBadgeSet.has(key)) return;
  userBadgeSet.add(key);
  userBadges.push([userId, badgeId, artistId, earnedAt]);
}

for (const artist of ARTISTS) {
  const allTime = topFor(artistUserPoints, artist.id, 1)[0];
  if (allTime) addBadge(allTime.userId, "first-blood", artist.id, at(addDays(TODAY, -95), 21, 40));
  const monthly = topFor(monthArtistUserPoints, artist.id, 1)[0];
  if (monthly) addBadge(monthly.userId, "top-1", artist.id, at(addDays(TODAY, -1), 23, 10));
  const crate = [...monthArtistUserDistinct.entries()]
    .filter(([key]) => key.startsWith(`${artist.id}|`))
    .map(([key, distinct]) => ({ userId: key.split("|")[1], distinct }))
    .sort((a, b) => b.distinct - a.distinct || a.userId.localeCompare(b.userId))[0];
  if (crate) addBadge(crate.userId, "crate-digger", artist.id, at(addDays(TODAY, -4), 19, 5));
}

for (const [key, streak] of streakByUser) {
  const [userId, artistId] = key.split("|");
  if (streak.current >= 30) addBadge(userId, "streak-30", artistId, at(addDays(TODAY, -1), 22, 0));
  else if (streak.current >= 7)
    addBadge(userId, "streak-7", artistId, at(addDays(TODAY, -2), 22, 0));
}

const nightOwls = usersByPoints.slice(2, 6);
nightOwls.forEach((user, index) => {
  addBadge(user.id, "night-owl", bestArtistFor(user), at(addDays(TODAY, -(3 + index)), 3, 20));
});

addBadge("demo-you", "rivalry", "nova-kestrel", at(addDays(TODAY, -2), 21, 45));
const rivalFan = fansByPoints[0];
if (rivalFan) addBadge(rivalFan.id, "rivalry", bestArtistFor(rivalFan), at(addDays(TODAY, -3), 20, 30));

await insertMany("user_badges", ["user_id", "badge_id", "artist_id", "earned_at"], userBadges);

/* Challenges for the current Monday-Sunday week. */
const challengeCreatedAt = at(addDays(mondayThisWeek, -2), 18, 0);

await insertMany(
  "challenges",
  [
    "id",
    "title",
    "description",
    "artist_id",
    "metric",
    "target",
    "bonus_points",
    "starts_on",
    "ends_on",
    "created_at",
  ],
  [
    [
      "challenge-nova-sprint",
      "Nova Sprint",
      "Stack 180 minutes on Nova Kestrel before Sunday night.",
      "nova-kestrel",
      "minutes",
      180,
      150,
      mondayThisWeek,
      sundayThisWeek,
      challengeCreatedAt,
    ],
    [
      "challenge-deep-cuts",
      "Deep Cuts",
      "Reach 40 distinct Midnight Arcade tracks this week.",
      "midnight-arcade",
      "distinct_tracks",
      40,
      200,
      mondayThisWeek,
      sundayThisWeek,
      challengeCreatedAt,
    ],
    [
      "challenge-global-grind",
      "Global Grind",
      "Log 300 minutes across any artist this week.",
      null,
      "minutes",
      300,
      100,
      mondayThisWeek,
      sundayThisWeek,
      challengeCreatedAt,
    ],
  ],
);

const challengeEntries = [
  ["challenge-nova-sprint", "demo-you", at(addDays(TODAY, -1), 9, 12), null],
];
fansByPoints.slice(0, 8).forEach((fan, index) => {
  const challengeId = CHALLENGE_IDS[index % CHALLENGE_IDS.length];
  challengeEntries.push([
    challengeId,
    fan.id,
    at(addDays(TODAY, -rndInt(1, 3)), rndInt(7, 22), rndInt(0, 59)),
    null,
  ]);
});
await insertMany(
  "challenge_entries",
  ["challenge_id", "user_id", "joined_at", "completed_at"],
  challengeEntries,
);

/* Rank snapshots for the previous week and previous month. */
const snapshotRows = [];
function addSnapshots(periodType, periodKey, pointsMap, capturedAt) {
  for (const artist of ARTISTS) {
    const ranked = topFor(pointsMap, artist.id, 20);
    ranked.forEach((entry, index) => {
      snapshotRows.push([
        entry.userId,
        artist.id,
        periodType,
        periodKey,
        index + 1,
        round2(entry.points),
        capturedAt,
      ]);
    });
    if (!ranked.some((entry) => entry.userId === "demo-you")) {
      const demoPoints = pointsMap.get(pairKey(artist.id, "demo-you")) ?? 0;
      if (demoPoints > 0) {
        snapshotRows.push([
          "demo-you",
          artist.id,
          periodType,
          periodKey,
          ranked.length + 1,
          round2(demoPoints),
          capturedAt,
        ]);
      }
    }
  }
}

addSnapshots("week", prevWeekKey, prevWeekArtistUserPoints, at(prevWeekEnd, 23, 50));
addSnapshots("month", prevMonthKey, prevMonthArtistUserPoints, at(prevMonthEndDay, 23, 50));
await insertMany(
  "rank_snapshots",
  ["user_id", "artist_id", "period_type", "period_key", "rank", "points", "captured_at"],
  snapshotRows,
);

/* Activity events across the last three days. */
const nowMs = Date.now();
const EVENT_KINDS = ["milestone", "badge", "overtake", "challenge", "join"];
const events = [];
const eventTemplates = [
  (actor, artist) => ({
    kind: "milestone",
    message: `${actor.name} passed ${(rndInt(2, 20) * 1000).toLocaleString("en-US")} points on ${artist.name}`,
    meta: { artistId: artist.id, threshold: rndInt(2, 20) * 1000 },
  }),
  (actor, artist) => ({
    kind: "badge",
    message: `${actor.name} unlocked the Night Owl badge on ${artist.name}`,
    meta: { artistId: artist.id, badgeId: "night-owl" },
  }),
  (actor, artist) => ({
    kind: "overtake",
    message: `${actor.name} just overtook ${pick(fansByPoints).name} on ${artist.name}`,
    meta: { artistId: artist.id },
  }),
  (actor, artist) => ({
    kind: "challenge",
    message: `${actor.name} is grinding the ${
      artist.id === "midnight-arcade" ? "Deep Cuts" : "Nova Sprint"
    } challenge`,
    meta: {
      artistId: artist.id,
      challengeId: artist.id === "midnight-arcade" ? "challenge-deep-cuts" : "challenge-nova-sprint",
    },
  }),
  (actor, artist) => ({
    kind: "join",
    message: `${actor.name} joined Ultfave and picked ${artist.name} first`,
    meta: { artistId: artist.id },
  }),
];

for (let i = 0; i < 30; i += 1) {
  const actor = users[(i * 7 + 3) % users.length];
  const artistId = pick(actor.artists);
  const artist = ARTIST_BY_ID.get(artistId);
  const kind = EVENT_KINDS[i % EVENT_KINDS.length];
  const template = eventTemplates[EVENT_KINDS.indexOf(kind)];
  const built = template(actor, artist);
  const minutesAgo = 15 + (29 - i) * 140 + rndInt(0, 50);
  events.push([
    `evt-${String(i + 1).padStart(2, "0")}`,
    kind,
    actor.id,
    artistId,
    kind === "overtake" ? pick(fansByPoints).id : null,
    built.message,
    JSON.stringify(built.meta),
    new Date(nowMs - minutesAgo * 60_000).toISOString(),
  ]);
}

await insertMany(
  "activity_events",
  ["id", "kind", "actor_id", "artist_id", "target_user_id", "message", "meta", "created_at"],
  events,
);

/* Plays for the last seven days for the top ten fans (realism only). */
const playsRows = [];
const tracksByArtist = new Map();
for (const track of tracks) {
  const list = tracksByArtist.get(track.artistId) ?? [];
  list.push(track);
  tracksByArtist.set(track.artistId, list);
}

const currentUtcHour = new Date().getUTCHours();
const currentUtcMinute = new Date().getUTCMinutes();
for (const fan of topFans) {
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = addDays(TODAY, -offset);
    const count = rndInt(2, 5);
    for (let n = 0; n < count; n += 1) {
      const artistId = pick(fan.artists);
      const track = pick(tracksByArtist.get(artistId));
      const rawHour = rnd() < 0.18 ? rndInt(0, 4) : rndInt(7, 23);
      const hour = day === TODAY ? Math.min(rawHour, currentUtcHour) : rawHour;
      const minute =
        day === TODAY && hour === currentUtcHour ? rndInt(0, currentUtcMinute) : rndInt(0, 59);
      playsRows.push([
        `play-${fan.id}-${day}-${n + 1}`,
        fan.id,
        track.id,
        artistId,
        at(day, hour, minute),
        day,
        round2(Math.min(track.durationMs, 480000) / 60000),
        round2(Math.min(track.durationMs, 480000) / 60000),
        "spotify",
      ]);
    }
  }
}

await insertMany(
  "plays",
  ["id", "user_id", "track_id", "artist_id", "played_at", "day", "minutes", "points", "source"],
  playsRows,
);

/* ---------------------------------------------------------------------------
 * Summary
 * ------------------------------------------------------------------------- */

async function count(table) {
  const result = await db.execute(`SELECT COUNT(*) AS c FROM ${table}`);
  return Number(result.rows[0].c);
}

const summary = {};
for (const table of [
  "users",
  "artists",
  "tracks",
  "daily_scores",
  "plays",
  "follows",
  "streaks",
  "badges",
  "user_badges",
  "challenges",
  "challenge_entries",
  "activity_events",
  "rank_snapshots",
]) {
  summary[table] = await count(table);
}

const weeklyDemo = await db.execute({
  sql: `SELECT COUNT(*) AS c, COALESCE(SUM(points), 0) AS p
        FROM daily_scores WHERE user_id = 'demo-you' AND day >= ? AND day <= ?`,
  args: [mondayThisWeek, TODAY],
});

console.log(`Seeded Ultfave demo data into ${url} (today ${TODAY})`);
console.log(
  `  challenge week ${mondayThisWeek} .. ${sundayThisWeek} | prev week ${prevWeekStart} (${prevWeekKey}) | prev month ${prevMonthKey}`,
);
console.log(
  `  demo-you current week: ${Number(weeklyDemo.rows[0].p)} points across ${
    weeklyDemo.rows[0].c
  } artist-days`,
);
for (const [table, value] of Object.entries(summary)) {
  console.log(`  ${table.padEnd(18)} ${value}`);
}

db.close();
