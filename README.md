# Educrazy

A functional Education.com-style learning platform built with **plain HTML, CSS, and JavaScript** plus **Supabase** for auth and data. No build step, no framework.

> Demo project for learning purposes. It is inspired by Education.com's structure and UX but uses original copy, colors, and assets. It is not affiliated with or endorsed by Education.com. Do not reuse their logo, illustrations, or content.

## What's included

| Page | Description |
|---|---|
| `index.html` | Marketing landing page: hero search, categories, premium pitch, stats, testimonials, school CTA |
| `resources.html` | Learning library with search, grade/subject/type filters, sorting, load more, save, and detail modal |
| `pricing.html` | Free / Premium (monthly-yearly toggle) / Schools plans + FAQ |
| `login.html`, `signup.html` | Supabase email/password auth with profile metadata |
| `dashboard.html` | Account overview, saved collection, progress, schedule, community feed, contests, and Edumate booking |
| `game.html` | Real-time arcade player (10 games) plus the standalone EC Games Live arena, with timer, lives, score, combo bonus, best score, and completion tracking |

### Features

- Email/password auth (Supabase Auth) with auto-created profile via database trigger
- Row Level Security: users can only read/write their own collections, items, and progress
- Threads-style community feed: open sharing between members and Edumates (not a classroom), with inline threaded replies, likes, reposts, follow, topics, and Untuk Kamu / Mengikuti / Edumate feeds
- Save/unsave resources to a default collection
- Mark resources complete and track progress
- Ten real-time arcade mini-games with sound effects, scoring, lives, and saved best scores, plus the EC Games Live multiplayer arena
- Premium gating on premium resources and premium games (`profiles.plan`)
- Demo mode: if Supabase is not configured, everything works with `localStorage`
- Responsive layout for desktop, tablet, and mobile

## Quick start (demo mode, no accounts)

```powershell
npx serve . -l 4173
# open http://localhost:4173
```

Or any static server, e.g. `python -m http.server 4173`. Opening `index.html` directly with `file://` will block `data/resources.json` in some browsers, so use a local server.

In demo mode the library loads from `data/resources.json`, and signups/collections/progress are stored in your browser only.

## Connect Supabase (real database + auth)

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the entire contents of `supabase/schema.sql`.
   - Creates `profiles`, `resources`, `collections`, `collection_items`, `progress`
   - Creates the community tables `community_posts`, `community_likes`, `community_reposts`, `community_follows`, plus the `community_authors` view
   - Enables RLS policies
   - Seeds 31 sample resources
   - Creates the signup trigger and the demo `set_plan` function
3. In **Project Settings > API**, copy:
   - Project URL
   - `anon` public key
4. Edit `assets/js/config.js`:

```js
window.EDUCRAZY_CONFIG = {
  SUPABASE_URL: "https://xxxxxxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...",
  SITE_NAME: "Educrazy",
  PREMIUM_MONTHLY: 15.99,
  PREMIUM_YEARLY: 119.99
};
```

5. Reload the site. The demo notice disappears and the library reads from the `resources` table.

### Auth settings

For the smoothest demo, disable email confirmation in **Authentication > Providers > Email**. If you keep it on, a new signup must confirm their email before logging in (the app handles that message).

### Premium flow

The pricing page's "Activate demo premium" calls the `set_plan('premium')` RPC, which flips `profiles.plan`. This is intentionally insecure for demo purposes and **bypasses payment**. For production:

1. Create a Stripe/Paddle checkout session server-side.
2. Verify the webhook signature.
3. Update `profiles.plan` from a trusted server function or service role.
4. Remove the client grant on `set_plan` in `supabase/schema.sql`.

## Project structure

```
.
├── index.html
├── resources.html
├── pricing.html
├── login.html
├── signup.html
├── dashboard.html
├── game.html
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── config.js       # Supabase credentials + prices
│       ├── supabase.js     # auth + data helpers, demo fallback
│       ├── main.js         # header, nav, toast, auth state
│       ├── resources.js    # library, filters, modal
│       ├── auth.js         # login/signup forms
│       ├── pricing.js      # billing toggle + demo upgrade
│       ├── dashboard.js    # collection, progress, calendar, community feed, contests, Edumate
│       └── game.js         # mini-game engine + ten game modes
├── zep-game/               # standalone EC Games Live multiplayer arena
│   ├── index.html
│   ├── style.css
│   ├── questions.js
│   ├── avatar.js
│   └── app.js
├── data/resources.json     # demo library (mirrors SQL seed)
├── data/learn-hub.json     # demo mentors, sessions, community posts, contests
└── supabase/schema.sql     # tables, RLS, triggers, seed
```

## Community

The **Komunitas** tab in `dashboard.html` is a Threads-style open sharing feed. The context is deliberately *not* a classroom: members and Edumates post freely about study habits, questions, wins, and recommendations.

- Composer with a 500-character limit, topic selector (`Umum`, `Curhat`, `Tanya`, `Tips`, `Pencapaian`, `Rekomendasi`), and optional illustration
- Three feeds: **Untuk Kamu** (everything), **Mengikuti** (people you follow), **Edumate** (verified Edumates only)
- Inline threaded replies with a connecting thread line, relative timestamps (`42m`, `2j`, `3h`), likes, reposts, follow/unfollow, copy link, and delete on your own posts
- Edumates carry a verified badge, derived from `profiles.role = 'teacher'` when Supabase is connected

Storage follows the rest of the app:

| Mode | Behaviour |
|---|---|
| Supabase connected | Reads and writes `community_posts`, `community_likes`, `community_reposts`, `community_follows`. Posts are readable by any signed-in user; inserts, updates, and deletes are restricted to the author by RLS. Author names and handles come from the `community_authors` view, which exposes no email, plan, or grade. |
| Demo (no Supabase) | Seed posts load from `data/learn-hub.json`; your posts, replies, likes, reposts, and follows are stored in `localStorage` only. |

Seed timestamps are anchored to the current time on load, so the demo feed always shows believable relative times instead of drifting fixed dates. The signup trigger also generates a unique `profiles.handle` for the `@mention` style identity.

## Games

Open any game resource from the library, or go directly to `game.html?id=<resource id>`. Every arcade game is a real-time round: a start screen, a live HUD, a target banner, sound effects, 3 lives, a timer, and a results screen with stars and a saved best score.

**EC Games Live** (`zep-game/index.html`) is the exception: it is a self-contained multiplayer game center copied in from the main Educrazy project. It has its own canvas engine, characters, three modes (Zones, Bunny Chase, Race), and connects to its own Supabase project for rooms. The library card routes to it through `url`/`EXTERNAL_GAMES` in `assets/js/resources.js`; if you use a different Supabase project, update the credentials at the top of `zep-game/app.js`.

| Game | Slug | How to play | Round |
|---|---|---|---|
| Alphabet Bubble Pop | `alphabet-bubble-pop` | Pop rising bubbles that match the target letter; wrong pops cost a life | 45s / 100 pts |
| Flipping Pancakes Fractions | `flipping-pancakes-fractions` | Flip falling pancakes that match the order ticket fraction; burnt = life lost | 50s / 150 pts |
| Counting Coins Arcade | `counting-coins-arcade` | Tap pennies, nickels, dimes, and quarters to build the exact amount; going over costs a life | 60s / 150 pts |
| Sight Word Safari | `sight-word-safari` | Catch the animal carrying the target sight word; speaker button plays it aloud | 50s / 150 pts |
| Irregular Nouns Ski Race | `irregular-nouns-ski-race` | Steer into the gate with the correct irregular plural (arrow keys, A/D, taps, or on-screen buttons) | 60s / 180 pts |
| Typing Rockets | `typing-rockets` | Type a falling word exactly to launch it; each streak adds combo points; words that land cost a life | 60s / 220 pts |
| Multiplication Meteor | `multiplication-meteor` | Blast the drifting meteor that carries the right product; a wrong blast costs a life | 60s / 200 pts |
| Rhyme Time Train | `rhyme-time-train` | Tap the passing train whose word rhymes with the target word; wrong trains cost a life | 50s / 160 pts |
| Punctuation Parade | `punctuation-parade` | Pick the period, question mark, exclamation mark, or comma that completes the sentence | 60s / 180 pts |
| Habitat Hop | `habitat-hop` | Send each animal to its correct habitat: forest, ocean, desert, savanna, arctic, or pond | 50s / 160 pts |
| EC Games Live | `ec-games-live` | Standalone class arena: create a room or play solo with bots in Zones, Bunny Chase, or Race | Live |

Runs end when the timer hits zero or all 3 lives are gone. Stars are awarded at 0.9x and 1.4x of the goal, best scores are stored per game in `localStorage`, and finishing with a score calls `markComplete()` for logged-in users. Free games are playable without login; premium games require `profiles.plan = 'premium'` (see the guest lock screen).

To add another game, add a resource with `type = 'game'` and a matching slug in the `GAMES` map inside `assets/js/game.js`. Each entry supplies `theme`, `genre`, `duration`, `goal`, `instructions`, control copy, and a `mount(arcade)` function. The engine provides scoring, lives, timers, looping callbacks, cleanups, sound, and the shared start/results screens. Gameplay is original CSS/DOM animation, so no external game assets are required.

## Customizing

- **Brand name/colors**: `index.html` and `assets/css/style.css` (`:root` tokens).
- **Prices**: `assets/js/config.js` and the price copy in `pricing.html`.
- **Resources**: add rows in `supabase/resources` (or `data/resources.json` in demo mode). Available types: `worksheet`, `game`, `lesson_plan`, `activity`.
- **Grades/subjects filters** are generated automatically from the data.
- **Copy on the landing page** is in `index.html`; every section is a standalone block.

## Known limitations / next steps

- Checkout is a stub — connect Stripe/Paddle before launch.
- Worksheet/lesson "Download resource" still shows a demo toast; add Supabase Storage and generated PDFs.
- Games are self-contained DOM arcade mini-games (no canvas/WebGL); high scores are per-browser unless Supabase completion is used.
- No file uploads, admin UI, email templates, or rate limiting yet.
- Single default collection per user; the schema already supports multiple collections.
- Replace sample content with original or properly licensed educational material.

## License

Demo code: use freely for learning and prototyping. Brand names and third-party content remain the property of their owners.
