---
description: When Mocky has no frame, animation, transition or element for what you asked, the model can make one. Each creation is checked before it is kept.
badge: New
---

# Creations

Mocky's frames, animations and components are catalogues written by hand and
tested once. Sometimes what you ask for is not in them. With **Creations** on,
the model may make the missing piece, and your next screens can use it again.

Switch it on per project, in the composer, under the generation aids. It adds one
model call per new screen, and one review per thing it makes. Most screens need
nothing and make nothing.

## What it can make

| Kind | What the model writes | What surrounds it |
|---|---|---|
| Frame | An SVG path | Mocky's own component, as a mask |
| Animation | Keyframes, as data | Mocky's own component |
| Transition | Two states, as data | Mocky's own component |
| Element | A React component | Nothing: this is the one kind that is code |

Films are not included. A Motion Ultra film renders on the server, and code
written by a model does not run there.

## What happens before one is kept

1. **Rules, with no model involved.** A path may only be path commands, a CSS
   value may not contain an address or close its rule. An element is read by a
   parser and refused if it touches anything outside a short allowed list: no
   network, no cookies or storage, no `eval`, no reaching the page around it.
2. **A real render**, in the same sandbox as a preview. It must mount without an
   error.
3. **An independent review.** A separate model call, with none of your
   conversation and none of your request: only the code, its comments removed,
   and the question of whether it is malicious or broken.

A creation that fails any step is dropped and the screen is generated without it.
A review that errors or answers something unreadable counts as a refusal.

## What this does and does not protect you from

The protection is the preview's sandbox: generated code cannot read your account
or reach the network, whether or not anyone reviewed it. The checks above are a
second layer, and neither rules nor a model can prove a piece of code harmless.

Your creations are yours alone: no other account on the instance sees them.

## Finding them again

**Media → Creations** lists what has been kept, with a preview, its code and what
the review said. Deleting one does not change the screens that already use it:
each screen keeps its own copy.
