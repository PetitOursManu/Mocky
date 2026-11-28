---
description: Your own pixel-art sprites, icons and tiles from Sprixy, used in your designs, read-only and project by project.
badge: New
---

# Your Sprixy game assets

[Sprixy](https://github.com/PetitOursManu/Sprixy) is a self-hosted studio of 2D game assets: pixel-art sprites,
characters, icons, tiles and UI elements. Connect **your** Sprixy to your Mocky account, and the assets of the projects
you choose to share there can go into your designs — a game's landing page, a store page, a poster for a game jam.

:::why Why a read-only token, and why the choice is made in Sprixy
A Sprixy token with full access can generate and spend your provider credit. Mocky only needs to look and copy, so it
accepts a **read-only catalog token** and refuses any other. And what may be used is decided where the assets live:
nothing is visible until you mark a project "Shared with apps" in Sprixy, and unsharing it takes effect at once.
:::

## Connect your Sprixy

:::steps
1. **In Sprixy, share a project.** Open the project and click **Share with apps** at the top. Do it for every project
   whose assets Mocky may use.
2. **In Sprixy, create a catalog token.** **Settings → API tokens**, choose **Read-only catalog**, name it "Mocky" and
   copy the `spx_…` token (it is shown once).
3. **In Mocky, connect.** **Settings → Sprixy**: paste your Sprixy's address and the token, then **Connect Sprixy**.
   Mocky checks it with Sprixy and lists the shared projects.
:::

The token is kept on the server for your account only and never shown again. **Disconnect** forgets it; revoking the
token in Sprixy cuts the access from that side.

## Use the assets in a design

Ask your assistant (Claude, ChatGPT…, [connected through MCP](mcp.md)) for a design and mention your Sprixy assets —
"a landing page for my game, with my goblin and knight sprites". It searches them with `search_sprixy_assets`, looks at
the thumbnails, and adds the ones it chooses with `add_image` (`sprixy_asset_id`). They land in your Media library,
credited "Sprixy", and the design uses them.

Sprites are pixel art, so Mocky treats them as such:

- Sprixy sends each one **already enlarged** by a whole number (about 512 px), with sharp pixels.
- The design shows them **whole** — never cropped or put in a round mask — with crisp pixels
  (`image-rendering: pixelated`) and a fixed size, over the background of their block.
- An animation or a sprite sheet gives its **first frame**.

## What Mocky can and cannot do with it

| | |
| --- | --- |
| Search and view the assets of shared projects | Yes |
| Copy a chosen asset into your Mocky library | Yes |
| See projects you did not share | No |
| Generate, change or delete anything in Sprixy | No — the token is read-only |
| Reach a Sprixy on a private network or `localhost` | No — Mocky only calls public addresses |
