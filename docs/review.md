---
description: Send a project to a client with a link that needs no account; they pin comments on the screens, then approve it or ask for changes.
badge: New
---

# Sending a project for approval

A project has a **status**: `Draft`, `In review`, `Changes requested` or
`Approved`. You change it by sending the project to someone — a client, a
colleague — who looks at the screens, **pins comments** on them, and **approves**
the project or **asks for changes**. They need no account on your instance.

Open it with `Approval` in the project toolbar.

## Sending

:::steps id=send-for-approval
1. **Choose how long the link lives**: 7, 30 or 90 days.
2. **Press `Send for approval`.** The project is saved as a version, exactly as
   it is now, and a link is created. The status becomes `In review`.
3. **Send the link** — copy it, or show its QR code.
:::

:::why
What the client sees is **frozen**: editing the project afterwards changes
nothing on their page. An approval is about something precise, and "they
approved the version I sent on the 3rd" is a sentence you can still check a year
later — the version is in the [Versions](versions.md) panel like any other.
:::

## What the client sees

The link opens a page with the project's screens and nothing else of Mocky:

- The screens **work like a site**: buttons, the links you drew between
  screens, forms.
- `Pin a remark`, then a click on the screen, drops a **numbered pin** there,
  and the comment written next is attached to it. The screen works again right
  after. A comment written without a pin is about the whole screen;
  `General remarks` takes comments about the whole project.
- `Approve` or `Ask for changes`, at the top. Asking for changes requires
  saying what should change. Once the project is approved, `Approve`
  turns grey and reads `Approved`; asking for changes stays possible.

The client signs with a name they type. Nothing checks that name: the link is
the authority, so send it only to the people who should answer.

:::why
The page never receives a screen's prompt, its design record or your private
notes: only what is needed to draw it. A brief is often the confidential part of
a project.
:::

## Reading the answers

The status shows on the project's card, beside its name in the header, and on
the `Approval` button with the **number of new answers**.

`Comments (N)` opens the same board the client sees — same screens, same pins.
You can **reply** to a comment and mark it **done** (`Mark as done`).

## The four statuses

| Status | Means |
|---|---|
| `Draft` | Never sent, or brought back with `Back to draft`. Drafts show no label on the cards. |
| `In review` | A link is out and nobody has decided yet. |
| `Changes requested` | The client asked for changes. Make them, then `Send the new version`. |
| `Approved` | The client approved the version that was sent. |

`Send the new version` saves the current state and creates a **new link**; the
previous one stays readable but takes no more comments. `Back to draft` closes
the current link the same way. `Revoke the link` makes it stop working at once.

The client may change their mind while the link is open: every decision is kept,
in order.

## Limits

| | |
|---|---|
| Model calls | None. |
| Comments | 400 per link, 2,000 characters each. |
| Links | 100 per account. A version shown by a live link cannot be deleted — revoke the link first. |

Deleting an account revokes its links.
