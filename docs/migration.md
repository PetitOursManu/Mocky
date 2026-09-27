# Maintenance and server migration

Two administrator tools that belong to one procedure: **maintenance mode** makes
the instance read-only, and **migration** moves an entire instance — accounts,
projects, provider keys, images, clips, films — to another server, piece by
piece, with a check of the new server before anything is replaced.

Both live in **Admin → Maintenance and migration**.

## Maintenance mode

When it is on, every user can still sign in, open their projects and browse
their media, but **nothing can be created, changed or deleted** — generation
included. A banner says so, with the message the admin wrote (a return time, for
instance). Administrators are not blocked.

### Why read-only, and not just "no creating or deleting"

The first request was to forbid creating and deleting while leaving edits
allowed. That rule cannot be enforced honestly: a user's projects reach the
server as **one blob** (`PUT /api/data`), so the server cannot tell an edit from
a deletion without diffing every project. And the main reason maintenance exists
is a migration's final pass — after which an *edit* is lost exactly like a
creation.

So the rule is a default-deny on the HTTP method (`server/maintenance.js`):
every `POST`, `PUT`, `PATCH` and `DELETE` is refused with `503` and
`code: "maintenance"`, except sign-in and sign-out. A route added next year is
covered without anybody remembering to list it. The one `GET` that writes — the
Dashy SSO callback creating an account on first sign-in — refuses to create one.

### What a user sees

- the banner, refreshed every minute and immediately on a refused write;
- the sync indicator reads **Paused** rather than a red failure: the changes
  stay in the browser and are sent as soon as maintenance ends;
- a generation fails with the maintenance message.

### Why admins pass

After an import, the new server boots **in maintenance** (the setting travels
with `config.json`), and whoever checks it has to be able to open a project and
try a generation before letting anyone else in. The flip side: on the **old**
server, what an admin changes after the final pass is not transferred. The
banner reminds them.

## Moving to a new server

### The procedure

1. **New server**: install Mocky (same version or newer), start it, create the
   first account — it becomes the admin.
2. **Old server**: Admin → *This is the old server* → your password → **Create a
   transfer code**. Copy it: it is shown once.
3. **New server**: Admin → *This is the new server* → the old server's address
   and the code → **Connect and check**. Read the checklist (below).
4. **First pass**, while the old server is still in use. This is the long one:
   the whole video library goes across.
5. **Old server**: turn **maintenance** on. Wait for renders in progress to end.
6. **New server**: **Run another pass**. It only transfers what changed, so the
   users are locked out for minutes rather than hours.
7. **New server**: your password → **Replace this server's data**. Mocky restarts
   (by itself under Docker, `restart: unless-stopped`; by hand otherwise).
8. Sign in to the new server **with your old server credentials**, check, then
   turn maintenance **off**. Move the DNS. Revoke the code on the old server.

### Why the new server pulls

Whichever side *receives* has to expose something that writes accounts, password
hashes and provider keys into its data directory — the most dangerous capability
the application could have. With a pull, that capability is an outbound download
into a staging area, on the server the admin is sitting in front of; the old
server only ever **reads**, and only the files its own list names. The old
server is also the one already reachable — it serves the users — while the new
one often is not until the DNS moves.

The alternatives, and why they were set aside:

| | For | Against |
|---|---|---|
| The old server pushes | Simple to picture | The new server exposes a write route for everything, and has to be reachable before the switch |
| An encrypted archive to download and re-upload | No network between the two | Not incremental; a multi-gigabyte upload a proxy may refuse; one failure restarts everything |
| **The new server pulls** (chosen) | Incremental, resumable, writes only locally, verified file by file | More code; a fourth SSRF bypass (below) |

### The checklist

On connecting, and again before every pass, the new server compares itself
with what the old one reports. Four checks **block**, because going ahead is
certain to break something:

- **Node** below 22.12;
- **Mocky** older than the old server's (an older version drops the fields it
  does not know the first time it writes);
- **disk space** below the total size plus 10 %;
- a data directory that **cannot be written**.

The others warn, because the admin may be about to fix them: an instance that
already holds data (it is set aside, then replaced); **ffmpeg** missing while the
old server has clips; the **render worker** unreachable at the address the
imported settings will use; **Dashy SSO** missing or different (its secret is
compared through a keyed hash, never sent); a different **MOCKY_ORIGIN**;
**TRUST_PROXY** set on one side only; clocks more than a minute apart (more than
four blocks, because the signatures stop working); the old server not yet in
maintenance; renders in progress.

After the import, **Check integrity** re-hashes every imported file against the
list it came with.

### What moves, and what does not

Everything in the data directory moves, **except**:

- `sessions.json` — a session token is a bearer credential, and one in transit
  is one more place it can leak from. Everyone signs in again once;
- `sso-jti.json` — a replay cache for 60-second tokens;
- temporary files and symbolic links.

The list is "everything minus these" rather than an enumeration of stores, so
the next store somebody adds is not silently left behind.

Environment variables (`.env`, compose) do **not** move: they belong to the
machine. The checklist is what tells you which ones matter.

### Security

- **End-to-end encryption.** The pairing code is 160 random bits. Both servers
  derive from it (HKDF-SHA256) a public identifier, a key that signs every
  request (HMAC-SHA256 over method, path, time and a nonce) and a key that seals
  every response (AES-256-GCM, bound to that request's nonce). Plain HTTP on a
  LAN, or a proxy that logs bodies, learns nothing and can change nothing.
- **Replay and brute force.** A request more than five minutes off, or whose
  nonce was already seen, is refused. After 20 bad signatures the code revokes
  itself.
- **In memory only.** The code, and the keys derived from it, are never written
  to disk on either side. It expires after 24 hours, is revoked by a button, and
  by any restart of the old server.
- **Password step-up.** Creating a code and replacing the data both ask for the
  admin's password again: an unlocked laptop is a session. (An SSO-only admin has
  no Mocky password; Dashy vouched for them at sign-in.)
- **Closed paths.** The old server serves only the files its last list named;
  the new server refuses a list containing a path it would not write — `..`,
  separators, drive letters, hidden names — and checks again that every path
  resolves inside its staging area.
- **Two-phase.** Nothing outside `.migration/` changes before the swap, and the
  swap moves the previous contents into `.migration/previous-<time>/` rather
  than deleting them.
- **Logs.** Every event is one line, `mocky migration <event> …`, in the same
  fixed shape as `mocky auth`.

The address typed on the new server is the **fourth administrator-only bypass of
the SSRF guard** (see [the invariants](architecture/invariants.md)): moving
between two machines on one LAN is the ordinary case, and the guard refuses
private addresses. What it would normally allow — reading an internal service —
it does not allow here: an answer is used only if it opens under the pairing key.

### If something goes wrong

- **A pass fails or is cut off**: run another. What is already staged with the
  right hash is not fetched again.
- **The new server restarted mid-transfer**: enter the code again; the staging
  area survives.
- **The old server restarted**: its code is gone. Create a new one and reconnect;
  the staging area is kept.
- **The import turns out wrong**: stop Mocky, move the contents of
  `.migration/previous-<time>/` back into the data directory, start again.
