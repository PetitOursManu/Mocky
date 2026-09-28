# The admin dashboard

Admin is one page with a menu on the left. Nine sections, one live stream:
everything that moves — who is connected, what is running, the processor, the
memory, the graphics card — updates every two seconds without a reload, and
moving between sections costs no request.

| Section | What it answers |
|---|---|
| **Overview** | Who is here, what is running, whether the machine and the providers are well — and, as sentences, the few things that need a decision. |
| **Live activity** | Every account, connected or not: state, where they are, what they are doing right now, what they did in the last hour. A per-kind chart and a feed of finished work. |
| **Users** | Public sign-ups, creating an account, resetting a password, deleting an account, the usage report — as before — plus each account's presence and **Sign out** (every device, password unchanged). |
| **Sessions** | Every signed-in browser: account, device, address, opened, last used. Close any one of them. |
| **System** | Processor, memory, event-loop delay, graphics card, disk, the film render worker. |
| **Providers** | How the text, image and video providers answered over the last hour, then their settings (the three blocks the old page had). |
| **Audit log** | Who did what: sign-ins and their failures, accounts, sessions, settings, maintenance, announcements, migrations. |
| **Announcement** | A message shown to everybody under the masthead, now or from a date you schedule, with an optional end — and dates in the text shown in each reader's time zone. |
| **Maintenance and migration** | Unchanged — see [Maintenance and migration](migration.md). |

The code is in `server/admin/` (one file per store, each explaining itself in its
header) and `src/components/admin/`.

## Presence

"Connected" needs a signal from the browser. Generation runs in the browser and
the server only relays the model call, so someone reading their canvas sends
nothing for minutes on end. Each signed-in tab therefore sends a heartbeat every
30 seconds: a random id minted per tab, the name of the screen it is on
(projects, a project, design, media, settings, admin), and whether it is in front.
Nothing else — never a project, a screen or anything typed.

| State | Meaning |
|---|---|
| **Active** | A tab is in front, or the account made a request in the last minute. |
| **In the background** | A tab is open but hidden. |
| **Offline** | No heartbeat for 150 seconds, or the last tab was closed. |

150 seconds and not 30 because every major browser throttles a hidden tab's
timers to one a minute. Closing a tab sends a goodbye (`sendBeacon`) so the account
goes offline at once rather than two minutes later.

The heartbeat does not count as activity, and it is allowed during maintenance:
it writes nothing, and refusing it would show everyone offline in exactly the
window in which an administrator wants to see who is still around.

## Activity

The server watches the requests that are work and records who, which kind, which
provider, how long and how it ended:

| Kind | Requests |
|---|---|
| Mocky | `/__provider/api/chat` — generation, edit, repair, polish, accessibility fix, planner, site reading, DESIGN.md, storyboard, photo choice |
| Muse | dossier, quality check, SEO/accessibility audit |
| Images | `/api/images/generate` |
| Free photos | search, pick, import |
| Video clips | `/api/videos/generate` |
| Motion Ultra films | compose, variants, queue — and the render itself, for the minutes it spends in the worker |

**The type of action only.** No prompt, brief, project name or provider error
text is ever recorded — an error message can quote the prompt it refused, so the
ending is reduced to a word (`succeeded`, `cancelled`, `rate-limited`, `refused`,
`timed out`, `unavailable`, `invalid`, `failed`) and an HTTP status. What a model
call is FOR travels as `x-mocky-purpose`, read from a closed list: the header comes
from a browser, and an open string would put a caller's words on the
administrator's screen.

In memory, one hour. A restart forgets it.

Under `npm run dev`, Vite relays the model calls itself, so generations do not
reach the Express process and do not appear; the Live activity screen says so. In
production everything is tracked.

## The machine

Sampled every 5 seconds, kept for an hour in memory. Three scopes, each on its own
chart:

- **the process** — Mocky's Node;
- **the container**, when there is one — Mocky and everything it starts (Muse's
  Chromium, the MCP servers, ffmpeg); this is the figure a Docker limit applies to;
- **the machine** — when Mocky is not in a container.

Inside a container the percentages are taken against the cgroup's limits, not the
hardware: on a 32-core host with a two-core limit, a process pinned at its ceiling
would otherwise read as 6 % busy. Container memory is the working set (usage less
inactive page cache) — the `docker stats` figure, the one the kernel weighs.

The event-loop delay (99th percentile) is the server's responsiveness: under 50 ms
is noise, past 200 ms every request waits and the overview says so.

## The graphics card

Mocky itself draws nothing on a GPU. The card is shown because an instance often
shares its machine with something that does — a local Stable Diffusion WebUI or
ComfyUI, a local LLM. It is the **whole card**, not Mocky's share.

What is asked, in order, all without installing anything:

| Source | Where | What it gives |
|---|---|---|
| `nvidia-smi` | Linux, Windows; Docker with the NVIDIA Container Toolkit | utilisation, VRAM, temperature, power |
| sysfs | Linux, AMD (`amdgpu`) | utilisation, VRAM |
| `ioreg` | macOS, Apple GPUs | utilisation |
| registry + `typeperf` | Windows, any vendor | utilisation (Task Manager's figure), VRAM |

Three answers are possible. **A figure**, when a source can measure the card.
**Unmeasurable**, when a card is there and nothing will say how busy it is — an
NVIDIA card without `nvidia-smi`, an Intel iGPU on Linux; the screen says which and
why, because "no GPU" on a machine with one sends people looking for the wrong
problem. **No GPU present**, when there is none — the display chips of servers
(ASPEED, Matrox) and of virtual machines do not count.

The card is read every 5 seconds while someone has the dashboard open and once a
minute otherwise; `typeperf` takes about three seconds of wall time per reading and
next to no CPU.

In Docker, an NVIDIA card is only visible with the NVIDIA Container Toolkit on the
host and `docker-compose.gpu.yml` on top of the usual file — see
[Deployment](deployment.md#the-graphics-card-in-docker).

## Provider health

Measured on users' real calls — there is no test request. Per kind and provider,
over the last hour: calls, failures and failure rate, time to first byte, median
and 95th-percentile duration, and the last event.

- **Cancellations do not count.** A user pressing Stop is not an outage.
- **Invalid requests do not count** (a 4xx, often Mocky's own validation — an empty
  prompt answered in 2 ms). They are shown beside the failures.
- **Durations cover successful calls only.** A refusal answered in 40 ms would
  make a failing provider look fast.
- **A browser's own key** is named by the host it points at and marked so, which
  tells "our OpenRouter account is failing" from "Alice's Ollama is down".

A provider failing at least 20 % of its calls, twice or more, turns its menu entry
red and gets a line on the overview.

## Sessions

A session token is the credential itself, so it never reaches the dashboard: a
session is shown and revoked by a hash of its token. What a session records about
its device is a summary of the user agent ("Firefox 131 · Windows"), never the
header, plus the address and the time it was opened. Sessions opened before this
version have neither.

Your own session cannot be closed from here — sign out instead, which also clears
the cookie. **Sign out** on the Users screen closes every session of an account
(yours: every one but this one); the password does not change.

## Audit log

Kept on disk, unlike everything else here, because it answers questions asked after
the fact. `audit.jsonl` in the data directory, one JSON object per line, the last
2,000 entries; it travels with a migration like every other file.

An entry never holds a password, a key, a token, a prompt, or the VALUE of a
setting: a settings change records which fields changed, so "the image provider key
was replaced" is visible and the key is not. Any detail whose name smells of a
secret is dropped whoever wrote the call. A failed sign-in records the account
name tried, never the password tried.

## The announcement

Stored in `config.json` beside the maintenance state and published through
`GET /api/config`, which every tab already polls once a minute and which a
signed-out visitor reads too. Plain text, 500 characters at most, an information or
warning tone, and an optional end date — an announcement about tonight's restart
still on screen next week teaches people to stop reading the banner.

It can start now or at a date you choose, up to a year ahead. Before its start
nobody sees it but the dashboard, where it shows as *scheduled*; the duration is
counted from the start, so "4 hours from Friday 20:00" ends at midnight. There is
one announcement at a time: publishing or scheduling replaces the current one.

**Dates in the text are written in each reader's time zone.** *Insert a date* puts
an instant into the message — `{{datetime:2026-09-29T01:22:00.000Z}}`, or `date:` /
`time:` for one half — and every browser writes it out on its own clock and in the
interface language: "Mise à jour prévue le 29/09/2026 à 03h22" in Paris, "…le
28/09/2026 à 21h22" in Montréal. Hovering it names the zone. Writing the
administrator's clock into the text instead would be right only for the people who
share it. The server refuses a date it cannot read rather than showing
`{{date:tomorrow}}` to everybody (`server/admin/announcement.js`,
`src/lib/announcementText.ts`).

Anyone can hide it. A new text gets a new id and comes back for everyone; changing
only the start or the end keeps the id, so fixing a typo in a date does not bring
back a banner everybody closed.

## What it costs

- **One open response per open dashboard**, a tick every 2 seconds (Server-Sent
  Events: no dependency, reconnects by itself, passes a reverse proxy; Nginx gets
  `X-Accel-Buffering: no`).
- **One heartbeat per tab every 30 seconds.**
- **A sample every 5 seconds**, a handful of system calls. The GPU spawns a process
  only while the dashboard is open, once a minute otherwise, and never at start-up.
- **Memory**: an hour of samples (720) and at most 5,000 activity events.
- **Disk**: the audit log only.
