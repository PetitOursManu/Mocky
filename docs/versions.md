---
description: Save a project or a screen, compare two states side by side, go back to any of them, and try another art direction on a branch.
badge: New
---

# Versions and branches

A project changes under you: an edit, a polish, a new art direction. Versions
let you **keep a state on purpose**, look at two states **side by side**, and
**go back** to any of them. Branches let you try **another direction** on the
same project without risking the one you had.

Open them with `Versions` in the project toolbar. A screen's own history is in
its context menu: `Versions of this screen`.

## Saving a version

Type a name (optional) in the `Versions` panel and press `Save`. The version
holds every screen of the project — its code, its prompt, its pictures, its
links — and the project's art direction (DESIGN.md).

:::why
Versions are kept on the server, not in the browser. The browser keeps the
working copy in a space of about 5 MB that the screens' code already fills;
ten copies of the project there would be the first thing to make saving fail.
On the server, a code shared by two versions is written once, so a version of
a project where one screen changed costs that one screen.
:::

A screen can also be saved on its own, from `Versions of this screen`.

## Comparing

Tick a version in the history, then:

- `Compare with the current state` — that version on one side, the canvas on the other;
- tick a second one and `Compare these two versions`.

The comparison window lists every screen of either side, marked **changed**,
**added**, **removed** or **unchanged**, and shows the chosen one side by side,
each at its own size. It also says when the **art direction** differs. Either
side can be switched to another version from its list.

## Going back

`Restore` on a project version puts the whole project back as it was: screens,
art direction, pinned reference screen.

:::why
Before anything is replaced, the current state is saved as an **automatic
save** on its branch. If that save fails — no network, a full disk — nothing is
restored. Going back must never cost the state you were in.
:::

The project's **name** is not restored: it is what you call the work, not a
state of it. Restoring a version saved on another branch puts the project on
that branch.

`Restore this screen`, from the comparison or a screen's history, brings back
that one screen and nothing else. It keeps where the screen sits on the canvas
and the notes written on it since. The ordinary `Revert` on the screen undoes
it, like it undoes an edit. A screen deleted since comes back as a new screen.

## Branches

A branch is another line of versions of the same project. The usual case:

:::steps id=try-a-direction
1. **The current direction is fine, and you want to try a darker one.** Create a
   branch named "Dark direction" from the `Versions` panel.
2. **Change what you like on it.** Edit the DESIGN.md, regenerate, polish. Save
   versions along the way.
3. **Go back to the main branch** with `Open`. The project returns to its main
   direction; the dark one stays on its branch.
4. **Open the dark branch again** whenever you want. Delete it when you have
   chosen.
:::

Switching branch saves the current state on the branch you leave, then opens the
newest version of the other one. A branch exists as long as it has versions; the
main one always exists. The branch you are on cannot be deleted — switch first.

## What a version costs

| | |
|---|---|
| Model calls | None. Saving, comparing, restoring and switching never call a model. |
| Disk | The server's, counted in the instance's storage limit (`MOCKY_MAX_STORAGE_MB`). Identical code is stored once. |
| Limits | 200 versions per project, 1,500 per account, 80 screens per version. Delete old versions from the history. |

Deleting an account deletes its versions.
