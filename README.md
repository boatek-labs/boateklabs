# Boatek Labs — Website + API (Node.js / Express)

Real Node.js/Express app: serves the site and handles the contact form, newsletter
signup, and Signal Capsule chat as actual working API endpoints — not stubs.

## Team

- **Foster Boateng** — Founder, Web Developer & Product Strategist
- **Abaye Jeremiah** — Python Engineer, Backend & Infrastructure
- **Gad Ackah** — Game Developer & 3D Artist
- Creative Collaborator — Product Ideas & Brainstorming

Team info is editable live via the Admin dashboard (see below) — it's stored in
`config/team.json` and served through `GET /api/team`, which both the homepage
and Team page fetch dynamically rather than having names hardcoded in HTML.

## Contact: four distinct forms, not one with a dropdown

`/contact.html` is a hub with four cards, each leading to its own dedicated form
with its own fields and its own backend endpoint — because a client wanting a
project built, a candidate wanting to be hired, an organization wanting to
partner, and someone with a general question are genuinely different intents:

| Page | Endpoint | Fields | Stored in |
|---|---|---|---|
| `start-a-project.html` | `POST /api/contact/project` | project type, name, email, brief, budget, timeline | `data/project-inquiries.json` |
| `join-the-team.html` | `POST /api/contact/careers` | name, email, role interest, portfolio URL, message | `data/career-applications.json` |
| `collaborate.html` | `POST /api/contact/collaborate` | organization, contact name, email, partnership type, message | `data/collaboration-requests.json` |
| `general-inquiry.html` | `POST /api/contact/general` | name, email, message | `data/general-inquiries.json` |

Every CTA across the site links to the page that actually matches its intent —
the Signal Capsule's "Start a Project" goes to the project form, the Team
page's hiring section goes to the careers form, Work's "client collaboration"
link goes to the partnership form, and so on. All four are viewable, and
individually deletable, from the Admin dashboard.

## Admin Dashboard

**http://localhost:3000/admin**

A real, password-protected internal dashboard — not a mockup. Log in with the
password from `ADMIN_PASSWORD` in `.env` (defaults to `changeme`; **change this
before deploying**).

**What it does:**

- **Overview** — live hosting-environment detection (recognizes Render, Railway,
  Fly.io, Vercel, Heroku, Koyeb, and a few others via their standard env vars;
  falls back to "Local / unrecognized host" otherwise), Node version, platform,
  uptime, memory usage, and whether SMTP is configured.
- **Submissions** — six tabs (Project Inquiries, Career Applications,
  Collaboration Requests, General Inquiries, Newsletter Subscribers, Signal
  Capsule Messages), each a real table read from the corresponding JSON store,
  with a working delete button per row.
- **Site Config** — edit the "Now Building" ticker, contact/support emails, and
  social links. Saves write directly to `config/site.json`, and the public site
  picks up the change immediately (no redeploy, no restart) since it fetches
  this data live via `/api/config`.
- **Team** — add, edit, or remove team members (name, role, tags, and whether
  they show as the "Hiring" card). Saves write to `config/team.json`, and the
  homepage + Team page reflect the change immediately via `/api/team`.

**Auth model:** a single shared admin password protects a session token stored
server-side in memory and handed to the browser as an httpOnly cookie (12-hour
expiry). The login endpoint is rate-limited (10 attempts / 15 minutes) separately
from the public-facing limiter. This is intentionally simple — no user accounts,
no roles — appropriate for a small studio's internal tool. If you later need
multiple admin logins with different permissions, that's a real feature add, not
a bug fix; the current single-password model is a deliberate scope choice.

**Theme:** the admin dashboard defaults to **white/light**, the opposite of the
public site's forced-dark default. On a user's very first visit to `/admin` (no
saved preference yet), it checks the OS/browser's `prefers-color-scheme` setting
once and follows it; after that, the manual dark/light toggle in the sidebar
takes over and persists via `localStorage`.

**Limitation worth knowing:** sessions live in server memory, so they don't
survive a restart and won't share across multiple instances behind a load
balancer — consistent with the file-based JSON storage the rest of this app
already uses. Fine for a single-instance deploy; if you scale beyond that, move
sessions to a shared store (Redis, a database table) using the same
`createSession`/`validateSession`/`destroySession` interface in
`lib/adminAuth.js`.

## Site-wide search

The search icon in the top bar opens a full-screen overlay with live filtering
across every real page and project (`public/js/search-index.js`) — not a UI
shell. Press `Esc` or the close button to dismiss.

## Designed emails, both directions

Every email this app sends — to the studio *and* back to the person who
submitted — uses the same branded HTML template (`lib/emailTemplates.js`):
dark navy header with the Boatek Labs mark, cyan accents, a clean field table,
and a call-to-action button. Plain-text fallback is always included too, for
email clients that don't render HTML.

- **To the studio:** a notification for each of the four inquiry types and the
  Signal Capsule chat, with a "View in Admin Dashboard" button.
- **Back to the visitor:** a designed confirmation email for each of the four
  forms (not sent for Signal Capsule chat, since that already gets an inline
  reply in the UI) — e.g. "We've got your brief" for a project inquiry, or
  "Thanks for applying" for a career application.

**Links in emails always point to the right host.** Rather than guessing which
platform this is deployed on, `lib/siteUrl.js` builds links from the actual
incoming request's host and protocol (`req.protocol` + `req.get('host')`) —
correct automatically whether that's `localhost:3000` in development, a
Render/Railway/Fly subdomain, or your final production domain, with zero
per-platform configuration. Set `SITE_URL` in `.env` only if you want to force
a specific value regardless of the request host.

## Status ticker, not "Now Building"

The topbar ticker now reads **Status: All Systems Live** by default (editable
from the Admin dashboard's Site Config panel) — the site is a complete,
production-ready build, not a work in progress, so it no longer says "Now
Building."

## Finishing touches for hosting

- **`robots.txt`** is a static file; **`sitemap.xml`** is generated live (see
  "Dynamic sitemap" below) — both point search engines at every real page,
  project, and journal post with no placeholder domain to remember to swap out.
- **Custom 404 page** (`public/404.html`) — on-brand, with real navigation back
  into the site, served with an actual `404` status code (not a redirect to
  the homepage, which search engines and monitoring tools would otherwise
  misread as a real page).
- **Open Graph + Twitter Card meta tags** on every page, so links shared on
  social media, Slack, or iMessage show a proper title, description, and
  preview image instead of nothing.
- **Scroll-spy badge redesigned** as a properly rounded circle (was a hex
  clip-path before) with a soft ring/glow treatment, present on every single
  page including the four new contact pages and the 404 page.

## Responsiveness

Breakpoints at 900px (tablet) and 480px (small phone) cover: hero and heading
sizes, the topbar (status ticker reflows, non-essential links hide on very
small screens while keeping the search icon clickable), the team/work grids
collapsing to fewer columns, the diamond stat blocks and process timeline
stacking vertically, decorative corner wedges hiding entirely on mobile (they
were pure decoration and looked cramped at narrow widths), and the Signal
Capsule capping its width so it never overflows the viewport. The Admin
dashboard has its own matching breakpoints — the sidebar collapses to a top bar,
data tables scroll horizontally instead of breaking, and team-editor fields
stack to one column.

## Requirements

- Node.js 18 or newer
- npm

## Setup

```bash
npm install
cp .env.example .env
```

Open `.env` and fill in real values — at minimum decide whether you're setting up
SMTP now or later (see "Email" below). Then run:

```bash
npm start
```

For local development with auto-restart on file changes:

```bash
npm run dev
```

The server listens on `http://localhost:3000` by default (configurable via `PORT`
in `.env`).

## What's real here

This is not a static-only demo. The following are fully working, tested end to end:

- **Contact form** (`/contact.html` → `POST /api/contact`) — validates input server-side,
  persists every submission to `data/contacts.json`, emails you a notification if SMTP
  is configured, and rejects spam via a hidden honeypot field (see "Spam protection" below).
- **Newsletter signup** (footer on every page → `POST /api/newsletter`) — validates,
  deduplicates by email, persists to `data/subscribers.json`, honeypot-protected.
- **Signal Capsule chat** (`POST /api/message`) — persists messages to `data/messages.json`,
  emails a notification if SMTP is configured, and returns a real acknowledgment reply.
- **Site-wide search** (search icon in top bar → full-screen overlay) — a real client-side
  search across projects, team members, and studio pages (`js/search-index.js`), not a
  placeholder UI. Press `Esc` or the close button to dismiss.
- **Dynamic footer/topbar** — social links and the "Now Building" ticker are served from
  `GET /api/config` (`config/site.json`) rather than hardcoded in every HTML file, so
  updating them once updates every page.
- **Privacy Policy page** (`/privacy.html`) — a real, complete policy reflecting exactly
  what this app collects (contact form, newsletter, chat) and how it's handled, not a
  Lorem Ipsum stand-in.
- **Health check** — `GET /api/health` for uptime monitoring / load balancer checks.
- **Rate limiting** on all three write endpoints (30 requests / 15 minutes per IP by
  default) to prevent spam/abuse.
- **PWA** — installable, with a service worker that caches the app shell for offline use.
- **Dark-mode-by-default theme**, persisted client-side, with a light-mode toggle.

## Spam protection

Two independent layers, no external CAPTCHA service required:

1. **Rate limiting** — 30 requests per 15 minutes per IP on `/api/contact`,
   `/api/newsletter`, and `/api/message` (configurable in `server.js`).
2. **Honeypot fields** — the contact and newsletter forms include a hidden `website`
   field that's invisible and unreachable by keyboard for real visitors, but that
   simple bots auto-fill. Submissions with that field populated are silently accepted
   (so the bot doesn't learn to adapt) but never stored or emailed.

If spam becomes a real problem beyond what these two catch, add hCaptcha or
reCAPTCHA to the contact form — that's the one item here still worth calling out
as a future addition rather than something already built.

## Email

Submissions and messages are saved to disk regardless of email configuration, so
you never lose data even before SMTP is set up. There are three tiers of behavior:

1. **Production SMTP configured** (`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` set in `.env`) —
   real emails sent through your provider.
2. **No SMTP configured, `NODE_ENV=development`** — the server automatically creates a
   free Ethereal test-SMTP account and actually sends the email through it, logging a
   preview URL in the console you can open to see the real rendered email. This requires
   outbound internet access to `ethereal.email`; if your network blocks that (as this
   development sandbox's did during testing), it safely falls back to tier 3 below
   instead of crashing.
3. **No SMTP configured, `NODE_ENV=production`, or Ethereal unreachable** — logs the
   full email content to the server console instead of sending, so nothing is lost.

To receive real email notifications, fill in `.env`:

```
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM=hello@boateklabs.com
CONTACT_TO_EMAIL=hello@boateklabs.com
```

Any standard SMTP provider works (Gmail with an app password, SendGrid, Mailgun,
Amazon SES, Postmark, etc.).

## Data storage

Submissions are stored as JSON files under `data/` (`contacts.json`,
`subscribers.json`, `messages.json`) using a small dependency-free file store
(`lib/jsonStore.js`) that serializes writes so concurrent submissions don't corrupt
the file. This is genuinely fine for a studio site's real-world traffic.

**When to upgrade:** if you deploy to a serverless/ephemeral filesystem host
(Vercel functions, AWS Lambda, etc.) or traffic grows enough that you want proper
querying/reporting, swap `lib/jsonStore.js` calls in `routes/*.js` for a real
database (Postgres, MongoDB, etc.) — the route files only touch `store.append()`
and `store.readAll()`, so the swap is contained to a handful of lines per route.

## Deployment

This is a standard long-running Node/Express process — it is **not** built for
serverless functions as-is (because of the file-based storage above). It deploys
cleanly to:

- **Render / Railway / Fly.io** — connect the repo, set the environment variables
  from `.env.example`, build command `npm install`, start command `npm start`.
- **A VPS** (DigitalOcean, Linode, etc.) — clone the repo, `npm install`, run with
  a process manager like PM2 (`pm2 start server.js --name boatek-labs`) behind
  Nginx as a reverse proxy for HTTPS.

Set `ALLOWED_ORIGIN` in `.env` to your real domain in production instead of
leaving it open.

## Project structure

```
boatek-app/
  server.js                Express app entry point
  package.json
  .env.example
  routes/
    inquiries.js           POST /api/contact/project|careers|collaborate|general
    newsletter.js          POST /api/newsletter
    message.js             POST /api/message
    config.js              GET  /api/config
    team.js                GET  /api/team
    projects.js            GET  /api/projects (filterable), GET /api/projects/:id
    journal.js             GET  /api/journal, GET /api/journal/:slug
    portal.js               POST /api/portal/:projectId/verify, GET /api/portal/:projectId/status
    github.js                GET  /api/github-stats?org=...
    analytics.js             POST /api/analytics/pageview (privacy-respecting beacon)
    rss.js                   GET  /rss.xml — live RSS 2.0 feed of the Journal
    sitemap.js                GET  /sitemap.xml — live sitemap incl. every project & post
    admin.js                Everything under /api/admin/* — see "Admin Dashboard" above
  lib/
    jsonStore.js            File-based JSON storage helper (append/readAll/updateById/removeById)
    mailer.js               SMTP + Ethereal-dev email helper
    emailTemplates.js        Branded HTML email template used for every email sent
    siteUrl.js               Builds correct links (emails, RSS, sitemap) from the real request host
    adminAuth.js             In-memory admin session management (token -> adminId + role + permissions)
    admins.js                Admin account CRUD, super/editor permissions, bcrypt hashing
    githubStats.js           Cached GitHub org stats fetcher
  config/
    site.json                Social links, contact/support email, status ticker text
    team.json                 Team member data — editable live via Admin
  content/
    projects.json             Projects CMS (incl. image gallery) — editable live via Admin
    journal.json               Journal/devlog CMS — editable live via Admin
  data/                     Persisted submissions + operational data (git-ignored, seeded empty)
    project-inquiries.json, career-applications.json,
    collaboration-requests.json, general-inquiries.json,
    subscribers.json, messages.json, admins.json,
    pageviews.json, newsletter-campaigns.json
  public/                   Static site (served at `/`)
    index.html, work.html, games.html, software.html, team.html,
    journal.html, journal-post.html, project.html, contact.html,
    start-a-project.html, join-the-team.html, collaborate.html,
    general-inquiry.html, portal.html, privacy.html, 404.html
    css/style.css
    js/main.js               Shared behavior, dynamic project/journal/search rendering, API calls
    manifest.json
    sw.js
    assets/                  Logo + generated PWA icon sizes
    uploads/                 Admin-uploaded project thumbnails (git-ignored, kept via .gitkeep)
    admin/                   Admin dashboard (separate light-default theme)
      index.html, admin.css, admin.js
```

## Theme

**Public site:** dark is the default on first visit, everywhere. The toggle in
the top bar switches to light mode and remembers the choice via `localStorage`
— it does not follow the OS/browser color-scheme preference, by design.

**Admin dashboard:** the opposite default — white/light, but it checks the
OS/browser's `prefers-color-scheme` once on a user's very first visit (no saved
preference yet) and follows that; the manual toggle takes over and persists
after that. See "Admin Dashboard" above for the reasoning.

## Team accounts: Super Admin + scoped Editors

The Admin dashboard supports real, separate logins with two account types —
built to mirror how the team's responsibilities are already split:

- **Super Admin** — full access to everything, including managing other admin
  accounts. This is the founder tier (you, Foster). There should usually only
  be one or two of these.
- **Editor** — scoped access. When you create an editor account, you assign
  exactly which sections they can edit: Projects, Journal, Team, Site Config,
  Submissions, and/or Newsletter. An editor can always *see* every panel, but
  their edit/save/delete controls only work for the sections you've checked
  off for them — enforced on the server, not just hidden in the browser, so
  it can't be bypassed by editing the page.

**Example matching your team:** give Gad the `projects` permission so he can
manage the Games/Software project listings and upload screenshots, and give
Abaye `config` + `submissions` so he can keep contact info current and triage
incoming inquiries — without either of them being able to touch the other's
area, delete team accounts, or send the newsletter. Adjust any editor's
permissions at any time from the **Team Accounts** panel; changes apply
immediately, no re-login needed.

The very first account is bootstrapped automatically as a Super Admin from
`ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` the first time the server starts.
After that, log in and manage further accounts from **Team Accounts**
(Super Admin only) — there's no reason to touch `data/admins.json` by hand.
Passwords are hashed with bcrypt; nothing is ever stored in plain text.

## Analytics

A real Analytics panel in the dashboard, computed from data already being
collected — no new tracking added to get this:

- **Submissions per week** (last 8 weeks) across all four inquiry types, shown
  as a small dependency-free bar chart (plain CSS/SVG, no charting library).
- **Project type breakdown** — which project types (Software/Game/Experience)
  people are actually asking about.
- **Pageviews** — total and unique-visitor counts over the last 30 days, plus
  the top 5 most-visited pages, sourced from the same privacy-respecting
  beacon described below.

## Privacy-respecting pageview tracking

Every page load pings `POST /api/analytics/pageview` with just the path and
referrer domain — no cookies, no persistent visitor ID. The "unique visitor"
count is based on a hash of (IP + today's date + a server-side salt that
rotates on restart), so it changes daily and can't be reversed back to an IP
or linked across days. This is a deliberately minimal, fully self-hosted
equivalent to privacy-first tools like Plausible or Umami — built into this
same app rather than requiring separate hosted infrastructure. If you later
want a more complete dashboard than this app's built-in one, dropping in
Plausible or Umami as a proper third-party service is a reasonable upgrade
path; this is meant to cover the "know roughly how many people visit and which
pages" need without adding any new infrastructure or third-party data
sharing today.

## Reply tracking, notes, and a hiring pipeline

Every submission table now has:
- A **Replied** checkbox — a simple way to track which submissions someone has
  actually followed up on.
- A **Note** field — free text for internal context ("called them back",
  "not a fit right now", etc.).
- Career Applications additionally get a **Status** dropdown (received →
  reviewing → interview → decided) — a lightweight hiring pipeline without a
  separate ATS.

## Export to CSV

Every submissions panel (Project Inquiries, Career Applications, Collaboration
Requests, General Inquiries, Subscribers, Signal Capsule Messages) has an
**Export CSV** button that downloads that table directly — useful for
spreadsheets, mail-merge, or just keeping an offline copy.

## Projects & Journal are now a real CMS

Work, Games, Software, the homepage's Featured Work section, and site-wide
search all pull from **one source of truth**: `content/projects.json`, edited
through the Admin dashboard's **Projects** panel. Add a project once, mark its
category (Software/Games/Experiences) and whether it's "Featured," and it
shows up in every relevant place automatically — no HTML editing required.

The same is true for the Journal: `content/journal.json`, edited through the
**Journal** panel, feeds the Journal page, the homepage's "From the Journal"
preview, individual post pages (`journal-post.html?slug=...`), and search.

## Featured toggle

Both Projects and Team members have a "Featured" checkbox in their respective
admin panels — toggle it and the homepage's condensed grids update immediately,
no separate step needed.

## File uploads

Project thumbnails can be uploaded directly from the Projects panel (JPG,
PNG, WEBP, or GIF, 3MB max) instead of relying on the built-in gradient
placeholders — files are saved to `public/uploads/` and served as normal
static assets. If no image is uploaded, projects fall back to one of three
brand-color gradient thumbnails automatically.

## Newsletter sending

The **Newsletter** panel lets an owner compose a subject and body and send it
to every subscriber in one action (via BCC, so subscribers never see each
other's addresses), using the same branded HTML email template as every other
email this app sends. Every send is logged in a campaign history so you can
see what went out and when.

## GitHub stats badge

A project can be linked to a real GitHub org or user (`githubOrg` field) to
show a live "X repos · Y stars" badge on its card — see the Church Attendance
System project, wired to `Huniso-Church-Of-Pentecost`. Stats are fetched
server-side with a 1-hour cache (`lib/githubStats.js`) so this never exceeds
GitHub's unauthenticated rate limit (60 requests/hour) regardless of site
traffic, and if GitHub is ever unreachable or rate-limited, the badge falls
back to the last successful result rather than showing broken UI.

## Client portal

Projects can have a simple password-protected portal
(`portal.html?project=<id>`) where a client enters a shared access code to see
a chronological list of project updates you post from the Projects panel.
This is intentionally a shared-code model, not individual client accounts —
appropriate for a small studio's handful of active relationships. If this
needs to grow into real per-client logins later, that's a genuine new feature
to build (see `routes/portal.js`), not a redesign of what's here.

**Recently updated indicator:** any portal update posted in the last 7 days
shows a "NEW" badge once the client is inside. There's also a lightweight
public status check (`GET /api/portal/:projectId/status`) that the portal's
gate screen calls *before* the access code is entered — it only ever returns
a yes/no "there's something new," never the update content itself, so a
client can tell there's something to check without you emailing them
separately, and without leaking any real information to someone who doesn't
have the code.

## Project image galleries + detail pages

Every project now has its own page (`project.html?id=<id>`) instead of just a
card: full description, an image gallery (click any thumbnail for a simple
lightbox), the full tech stack, an external "Visit Live Site" button if a link
is set, live GitHub stats if linked, and the client portal entry point if
enabled. Upload gallery images from the Projects panel — the first image
uploaded automatically becomes the card's cover thumbnail if one hasn't been
set separately.

## Tag + category filtering on Work

The Work page's Featured Projects section has interactive filter chips —
category (Software/Games/Experiences) and every tech-stack tag currently in
use — built from real project data, not a hardcoded list. Filtering happens
client-side after one fetch, so clicking between filters is instant.

## RSS feed for the Journal

`GET /rss.xml` is a real, spec-valid RSS 2.0 feed generated live from
`content/journal.json` — add a new post in the admin Journal panel and it
appears in the feed immediately. Discoverable via the standard
`<link rel="alternate" type="application/rss+xml">` tag in every page's
`<head>`, and there's a visible "Subscribe via RSS" link on the Journal page
itself.

## Dynamic sitemap

`GET /sitemap.xml` is generated live rather than a static file — it includes
every static page *and* every current project and journal post automatically,
using the real request host (via `lib/siteUrl.js`) so the URLs are always
correct for wherever this ends up deployed, with no domain placeholder to
remember to swap out.

## Crash safety net

A bug in one request handler (a typo'd method name, an unexpected `undefined`,
etc.) will no longer take the entire site offline. `server.js` registers
process-level `uncaughtException`/`unhandledRejection` handlers that log the
error loudly and keep the server running, on top of Express's normal
per-request error handling. Worth knowing: this is a pragmatic choice for this
app's architecture (stateless JSON file operations, nothing that could be left
"half-written" in memory) rather than a universal best practice — if this ever
grows in-memory state that a mid-operation crash could leave inconsistent,
revisit whether staying up after an uncaught exception is still the right call.

## Still worth doing before a public launch

- Point `CONTACT_TO_EMAIL` and SMTP settings at real infrastructure (currently logs to
  console/Ethereal until you do — see "Email" above).
- **Change `ADMIN_PASSWORD` from the `changeme` default** before deploying — this is
  the one item here that's a real security requirement, not a nice-to-have.
- Replace the placeholder social URLs (marked `REPLACE_WITH_REAL_HANDLE`) with your
  real LinkedIn/X/GitHub profile links — do this from the Admin dashboard's Site
  Config panel rather than editing `config/site.json` by hand; it's the same effect,
  live, with no redeploy.
- Swap the placeholder work/journal project descriptions for final copy as real case
  studies get written up — do this from the Admin dashboard's Projects and Journal
  panels; search results update automatically since search is built from the same
  live data, not a separate file to maintain.
- If spam volume ever exceeds what rate limiting + the honeypot catch, add hCaptcha or
  reCAPTCHA to the contact forms — everything else spam-related is already handled (see
  "Spam protection" above).


## Recent improvements

- RSS feeds are intentionally XML: `/rss.xml` is the machine-readable feed that RSS apps subscribe to. The Journal page now explains this when opening the feed. Configure `SITE_URL` to the canonical production domain so RSS links and verification emails use the correct host.
- Home page includes a Paystack donation flow. Configure `PAYSTACK_SECRET_KEY` server-side; payment initialization and callback verification are handled by the server.
- Newsletter subscriptions now use a 6-digit email verification code with a 15-minute expiry and up to five attempts. Verification records are written to `data/newsletter-verifications.json` with hashed OTPs (not plaintext codes). The file is excluded from Git and created with restricted permissions.
- Successful verification adds the subscriber and triggers a branded welcome email. SMTP must be configured for real production delivery.
- Admin newsletter panel includes AI drafting (OpenRouter-compatible endpoint), editing before send, and recipient segments: all subscribers, recent subscribers (30 days), or a specific list of email addresses. Subscriber recipients are sent as blind recipients in batches.
- Admin login email matching is normalized to lowercase and trimmed, fixing common case/whitespace mismatches for new accounts.

### New environment variables

`PAYSTACK_SECRET_KEY`, `OPENROUTER_API_KEY`, `NEWSLETTER_AI_MODEL` (defaults to `openai/gpt-4o-mini`), and `OTP_SECRET`. Set `OTP_SECRET` to a long random secret in production. The newsletter AI requires `OPENROUTER_API_KEY`; donations require `PAYSTACK_SECRET_KEY`; real verification/welcome/newsletter email requires SMTP configuration.
