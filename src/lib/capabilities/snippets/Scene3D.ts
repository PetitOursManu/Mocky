/**
 * `<Scene3D preset="…">` — the only 3D surface the generating model sees.
 *
 * THE RULE THIS ENFORCES
 *
 * The model never writes three.js. It never creates a renderer, never authors a
 * geometry, a material, a light or a shader. It picks a name from a closed list
 * and says where the element sits, exactly as it does with `<Animated>` and
 * exactly as Motion's compose prompt does with its blocks. Everything below is
 * written once, here, so a model that misremembers an API cannot produce a
 * screen that renders a black rectangle — the worst it can do is name a preset
 * that does not exist, which draws the still fallback and nothing else.
 *
 * WHY EVERY SCENE IS PROCEDURAL
 *
 * The preview's CSP sets `connect-src 'none'`: a glTF, an HDRI or a texture file
 * could not be fetched at all. So a scene is geometry the code builds and light
 * the code places, and that is a constraint the catalogue was designed around
 * rather than one it fights.
 *
 * THE CONTEXT BUDGET, WHICH IS THE WHOLE DIFFICULTY
 *
 * A browser keeps about sixteen live WebGL contexts per renderer process and
 * silently kills the OLDEST when a seventeenth is asked for — measured: twenty-
 * four iframes asking for one produced eight losses. Mocky's canvas shows many
 * screens at once, each its own iframe, so the screens would take that budget
 * from each other and a scene somewhere off-view would blank a scene somebody is
 * looking at.
 *
 * A frame cannot arbitrate that: it sees only itself. So the PARENT decides —
 * `Canvas` grants the budget to the screens nearest the viewport and posts
 * `{__mockyCmd:'gl', on}` to the rest (see Preview.tsx) — and this component
 * does three things with the answer:
 *
 *   1. It renders only while granted, and pauses when the document is hidden or
 *      the element is scrolled out of its own page.
 *   2. Before it gives a context up it captures the last frame as an image, so
 *      what replaces a live scene is that scene, held still — not a hole.
 *   3. It listens for `webglcontextlost`, because the browser can take the
 *      context anyway, and shows the same still if it does.
 *
 * Nothing granted, no WebGL at all, or `prefers-reduced-motion`: the element is
 * a quiet gradient built from its own colour. A page that loses its 3D looks
 * plainer; it never looks broken.
 */
export const Scene3DSource = `var MOCKY_SCENES = {
  orb: { body: 'sphere', lit: true, spin: 0.35, bob: 0.4, fits: true },
  solid: { body: 'knot', lit: true, spin: 0.55, bob: 0.2, fits: true },
  crystal: { body: 'crystal', lit: true, spin: 0.4, bob: 0.3, fits: true },
  ring: { body: 'torus', lit: true, spin: 0.6, bob: 0.15, fits: true },
  globe: { body: 'globe', lit: false, spin: 0.22, bob: 0, fits: true },
  stack: { body: 'stack', lit: true, spin: 0, sway: 0.34, bob: 0.5, fits: true },
  bubbles: { body: 'bubbles', lit: true, spin: 0.16, bob: 0.6, fits: true },
  particles: { body: 'points', lit: false, spin: 0.12, bob: 0, fits: false },
  grid: { body: 'grid', lit: false, spin: 0, bob: 0, fits: false },
  wave: { body: 'wave', lit: true, spin: 0.08, bob: 0, fits: false }
};

var MOCKY_SCENE_SPEED = { slow: 0.55, medium: 1, fast: 1.7 };

/* Breathing room around a body that has to fit: the bound below is tangency,
   and an object touching all four edges reads as an object that did not fit. */
var MOCKY_SCENE_MARGIN = 1.08;

/* How far a scene turns towards the cursor and with the scroll, in radians, and
   how fast it gets there.

   Small on purpose. A decoration that swings to face the pointer stops being a
   decoration and becomes the thing the page is about — and every one of these
   numbers is paid twice, because a hero scene is also the still that replaces
   it. Ten degrees of yaw is enough for an eye to read the object as present in
   the room rather than printed on the page. The damping is what stops the
   object snapping: a pointer event is a jump, and an object that jumps reads as
   a bug however small the jump is. */
var MOCKY_LOOK_YAW = 0.18;
var MOCKY_LOOK_PITCH = 0.12;
var MOCKY_SCROLL_TILT = 0.1;
var MOCKY_LOOK_EASE = 0.08;
/* How far the camera slides, as a share of the body's own reach — see the note
   where it is spent. */
var MOCKY_LOOK_SLIDE = 0.05;

/**
 * ONE LIVE SCENE PER SCREEN, enforced here rather than asked for in the card.
 *
 * The canvas grants a context PER SCREEN — it hands {__mockyCmd:'gl', on} to
 * an iframe and cannot see inside it — so a screen that draws three scenes
 * spends three of the browser's sixteen while the arbiter believes it spent
 * one. Four such screens are twelve, the seventeenth context kills the oldest,
 * and a scene somebody is LOOKING at goes blank because of a page nobody is.
 * The whole budget rests on one scene per frame being true, and until this it
 * was only requested: the capability card says "at most ONE per screen", which
 * is a sentence a model can miss and a person editing code can undo.
 *
 * First to mount holds the slot — source order, which is the order a reader
 * meets them in. The others draw the gradient they draw in a browser with no
 * WebGL: plainer, never broken, and the one they would have been given anyway
 * once the seventeenth context arrived.
 */
function mockySceneClaim() {
  try {
    if (window.__mockyScene) return false;
    window.__mockyScene = true;
    return true;
  } catch (e) {
    /* No window to count in is no canvas to starve: draw. */
    return true;
  }
}

function mockySceneRelease() {
  try { window.__mockyScene = false; } catch (e) {}
}

/** Where the element sits in the viewport, as -1 (entering) to 1 (leaving). */
function mockySceneScroll(box, viewport) {
  var mid = box.top + box.height / 2;
  var span = viewport / 2 + box.height / 2;
  if (span <= 0) return 0;
  return Math.max(-1, Math.min(1, (viewport / 2 - mid) / span));
}

/**
 * How far the camera must sit for a body of radius R to be INSIDE the box.
 *
 * An object clipped by a straight vertical line is the one defect a viewer
 * reads as broken software rather than as a plain scene, and the catalogue
 * shipped with it: the camera sat at a fixed distance framed for a wide box, so
 * a sphere in a tall one was cut on both sides and a knot in a square one on all
 * four. Measured on a rendered probe sheet of the six presets at three aspect
 * ratios — four of the six were cut.
 *
 * The closed form is the bounding sphere's tangency in the narrower of the two
 * half-angles: horizontally, tan(h) = tan(v) * aspect, so a tall box has the
 * smaller one and decides. Rotation is free — a bounding SPHERE is what the spin
 * cannot change, which is why the bound is taken on the geometry rather than on
 * the object's own idea of its size.
 */
function mockySceneReach(radius, fovDeg, aspect) {
  var halfV = (fovDeg * Math.PI) / 360;
  var halfH = Math.atan(Math.tan(halfV) * Math.max(0.0001, aspect));
  return (radius / Math.sin(Math.min(halfV, halfH))) * MOCKY_SCENE_MARGIN;
}

/** A hex the palette can be measured through, or the fallback. Never a string from a model, unchecked. */
function mockySceneColor(value, fallback) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3}([0-9a-fA-F]{2})?)?$/.test(value.trim())
    ? value.trim()
    : fallback;
}

/**
 * The still: what a scene looks like when it has no context to draw in.
 *
 * A gradient of its own colour rather than a grey box, because the element has
 * a size the layout already gave it and an empty one reads as a broken image.
 */
function mockySceneStill(color) {
  return 'radial-gradient(120% 90% at 30% 20%, ' + color + '33, transparent 70%), ' +
         'radial-gradient(90% 80% at 75% 80%, ' + color + '22, transparent 65%)';
}

function Scene3D(props) {
  var preset = MOCKY_SCENES[props.preset] ? props.preset : 'orb';
  var scene = MOCKY_SCENES[preset];
  var color = mockySceneColor(props.color, '#6366f1');
  /* The second hue, and why it is optional: a page has two colours far more
     often than one, and a scene painted in a single ink beside a two-colour
     palette is the thing that made the first six read as the same object in
     different shapes. Absent, it IS the first colour — nothing composite turns
     into a stripe because a model only knew one hex. */
  var accent = mockySceneColor(props.accent, color);
  var speed = MOCKY_SCENE_SPEED[props.speed] || MOCKY_SCENE_SPEED.medium;
  var host = React.useRef(null);
  var stillRef = React.useRef(null);
  var poster = React.useState(null);
  var posterUrl = poster[0], setPoster = poster[1];

  React.useEffect(function () {
    var node = host.current;
    if (!node || !window.THREE) return;
    var THREE = window.THREE;

    var reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    /*
     * The slot, and the two paths that do not need one.
     *
     * A still is one frame and the context back inside the same task, so a
     * capture frame or a reduced-motion page never holds two at once — and
     * refusing the second scene there would put a gradient in a thumbnail that
     * could have had the object. Everywhere else, the second scene on a screen
     * is the one the canvas never counted.
     */
    var rationed = !(stillOnly || reduced);
    var slot = rationed ? mockySceneClaim() : true;
    if (!slot) return function () {};

    var renderer = null, raf = 0, disposed = false, visible = true, drew = false, granted = window.__mockyGL !== false;
    /* A capture frame asks for ONE frame and then the context back — see
       lib/capture.ts. html2canvas cannot read a live WebGL canvas (the drawing
       buffer is gone by the time it clones the document), so a screen with a
       scene used to be thumbnailed as an empty gradient. A still is an <img>,
       which it copies perfectly. Two other cases take the same path for their
       own reason, and both are the same sentence: a scene that must not move
       has no use for a context. prefers-reduced-motion is one. The Sans
       animation switch is the other — it said no animation while the object
       kept turning, which is how that switch already looked broken once (see
       the note on buildSrcDoc's animations argument), one library over. */
    var stillOnly = window.__mockyStill === true || window.__mockyAnimations === false;
    var settled = false, ladderTimer = 0, owed = false;
    /* What the capture shell waits on: the number of scenes on this page that
       still owe their one frame. A count and not a flag, because a screen may
       hold more than one element even though the card asks for one. */
    function owe(on) {
      if (on === owed) return;
      owed = on;
      try { window.__mockyStillPending = Math.max(0, (window.__mockyStillPending || 0) + (on ? 1 : -1)); } catch (e) {}
    }
    /* The elapsed seconds, from the page's own clock.
       THREE.Clock is deprecated in 0.185 and says so in the console of every
       screen that draws a scene — three lines per preview, in a console a user
       reads to find their OWN error. Nothing here needed it: a start stamp and
       a subtraction are what it was doing, and dropping the class takes it out
       of the vendored bundle as well. */
    var startedAt = (window.performance && performance.now) ? performance.now() : Date.now();
    function elapsed() {
      var at = (window.performance && performance.now) ? performance.now() : Date.now();
      return (at - startedAt) / 1000;
    }
    var scene3 = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 4.2);
    var group = new THREE.Group();
    scene3.add(group);

    var col = new THREE.Color(color);
    var acc = new THREE.Color(accent);

    /* Everything this scene allocated, disposed together.
       Half the catalogue is composite now — a globe is dots plus a ring, a
       stack is three panels — and a geometry or a material left out of the
       cleanup is GPU memory that outlives the screen that asked for it. One
       list, one loop, no bookkeeping per preset. */
    var owned = [];
    function keep(thing) { owned.push(thing); return thing; }

    /** The surface a body is made of, in one ink: lit if the preset has matter. */
    function skin(ink) {
      return keep(scene.lit
        ? new THREE.MeshStandardMaterial({ color: ink, roughness: 0.32, metalness: 0.15 })
        : new THREE.MeshBasicMaterial({ color: ink }));
    }

    /** A cloud of points from a flat array of positions. */
    function cloud(positions, size, ink, opacity) {
      var g = keep(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      return new THREE.Points(g, keep(new THREE.PointsMaterial({ color: ink, size: size, transparent: true, opacity: opacity })));
    }

    var waveGeom = null, wavePos = null, waveBase = null, drift = null, driftSpan = 0;

    if (scene.body === 'points') {
      var COUNT = 900;
      var pos = new Float32Array(COUNT * 3);
      for (var i = 0; i < COUNT; i++) {
        /* A deterministic scatter: the same screen draws the same field twice,
           which is what makes a captured still match what was on screen. */
        var a = i * 2.399963;
        var r = 0.35 + 1.55 * Math.sqrt((i % 300) / 300);
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = (((i * 37) % 100) / 100 - 0.5) * 2.4;
        pos[i * 3 + 2] = Math.sin(a) * r;
      }
      group.add(cloud(pos, 0.035, col, 0.85));
    } else if (scene.body === 'globe') {
      /* A sphere of dots rather than a lit ball, and one ring around it in the
         second hue — the same object Motion draws as its globe block, under the
         same name, so a film and the page it came from say the same word. The
         spiral is Fibonacci, which is what makes the dots evenly spaced instead
         of bunched at the poles. */
      var GN = 760, gp = new Float32Array(GN * 3), GR = 1.22;
      for (var gi = 0; gi < GN; gi++) {
        var gy = 1 - (gi / (GN - 1)) * 2;
        var gr = Math.sqrt(Math.max(0, 1 - gy * gy));
        var ga = gi * 2.399963;
        gp[gi * 3] = Math.cos(ga) * gr * GR;
        gp[gi * 3 + 1] = gy * GR;
        gp[gi * 3 + 2] = Math.sin(ga) * gr * GR;
      }
      group.add(cloud(gp, 0.03, col, 0.9));
      var orbit = new THREE.Mesh(keep(new THREE.TorusGeometry(1.5, 0.012, 8, 120)), keep(new THREE.MeshBasicMaterial({ color: acc })));
      orbit.rotation.x = 1.12;
      orbit.rotation.z = 0.32;
      group.add(orbit);
    } else if (scene.body === 'stack') {
      /* Three cards floating in depth — the shape a product page reaches for,
         and the one a sphere cannot stand in for. It SWAYS rather than spins:
         a panel turned edge-on is a hairline, so a full rotation would spend
         half of every turn showing nothing. */
      var panel = keep(new THREE.BoxGeometry(1.75, 1.0, 0.07));
      var PANELS = [
        { y: 0.66, z: -0.55, tilt: -0.16, ink: acc },
        { y: 0, z: 0, tilt: 0.05, ink: col },
        { y: -0.66, z: 0.55, tilt: 0.17, ink: acc }
      ];
      for (var pi = 0; pi < PANELS.length; pi++) {
        var card = new THREE.Mesh(panel, skin(PANELS[pi].ink));
        card.position.set(0, PANELS[pi].y, PANELS[pi].z);
        card.rotation.z = PANELS[pi].tilt;
        card.rotation.x = -0.1;
        group.add(card);
      }
    } else if (scene.body === 'bubbles') {
      /* A cluster rather than one ball: same material, seven sizes, two inks.
         The positions are written down instead of scattered at random for the
         reason the point field is — a still has to match the frame it replaced. */
      var ball = keep(new THREE.SphereGeometry(1, 28, 20));
      var BUBBLES = [
        { x: 0, y: 0.1, z: 0, r: 0.72, ink: col },
        { x: -1.02, y: 0.62, z: -0.3, r: 0.36, ink: acc },
        { x: 0.94, y: -0.5, z: 0.2, r: 0.46, ink: acc },
        { x: 0.78, y: 0.82, z: -0.5, r: 0.28, ink: col },
        { x: -0.72, y: -0.74, z: 0.35, r: 0.3, ink: col },
        { x: 1.24, y: 0.24, z: -0.9, r: 0.2, ink: acc },
        { x: -1.3, y: -0.14, z: 0.6, r: 0.22, ink: col }
      ];
      for (var bi = 0; bi < BUBBLES.length; bi++) {
        var b = BUBBLES[bi];
        var bubble = new THREE.Mesh(ball, skin(b.ink));
        bubble.position.set(b.x, b.y, b.z);
        bubble.scale.setScalar(b.r);
        group.add(bubble);
      }
    } else if (scene.body === 'grid') {
      /* A floor of dots running away under the camera, and the only preset that
         MOVES rather than turns: the rows travel towards the viewer and wrap, so
         the illusion is of going somewhere. A field, so it bleeds past the box —
         framing a horizon whole would put it in the middle of the frame, which
         is the one place a horizon never is. */
      var COLS = 34, ROWS = 26, STEP = 0.32;
      var gpos = new Float32Array(COLS * ROWS * 3), gk = 0;
      for (var rz = 0; rz < ROWS; rz++) {
        for (var cx = 0; cx < COLS; cx++) {
          gpos[gk++] = (cx - (COLS - 1) / 2) * STEP;
          gpos[gk++] = 0;
          gpos[gk++] = -rz * STEP;
        }
      }
      /* A floor AND a ceiling, which is what makes it a tunnel rather than a
         plain. A horizontal plane seen nearly edge-on can never cover the top
         of its box — in a tall one the floor sat in the bottom fifth and the
         rest was empty sky, and a field that leaves most of its box empty is
         the motif-floating-in-the-middle failure with extra steps. */
      drift = new THREE.Group();
      var floorDots = cloud(gpos, 0.028, col, 0.9);
      floorDots.position.y = -0.95;
      drift.add(floorDots);
      var roofDots = cloud(gpos, 0.028, acc, 0.55);
      roofDots.position.y = 0.95;
      drift.add(roofDots);
      driftSpan = STEP;
      group.add(drift);
    } else if (scene.body === 'wave') {
      waveGeom = keep(new THREE.PlaneGeometry(6, 4, 48, 32));
      var sheet = new THREE.Mesh(waveGeom, skin(col));
      sheet.rotation.x = -1.05;
      sheet.position.y = -0.4;
      wavePos = waveGeom.getAttribute('position');
      waveBase = Float32Array.from(wavePos.array);
      group.add(sheet);
    } else {
      var solid = keep(
        scene.body === 'knot' ? new THREE.TorusKnotGeometry(1, 0.34, 120, 20)
        : scene.body === 'torus' ? new THREE.TorusGeometry(1.15, 0.32, 24, 96)
        : scene.body === 'crystal' ? new THREE.IcosahedronGeometry(1.35, 0)
        : new THREE.SphereGeometry(1.35, 48, 32)
      );
      group.add(new THREE.Mesh(solid, skin(col)));
    }

    /* What must FIT, and what may bleed.
       A body is an object: a cut edge reads as a broken render, so the camera is
       dollied until everything the group holds is inside the box. A field is a
       texture — the point cloud, the horizon grid and the rippling surface are
       meant to run past the edges exactly as a background does, and framing one
       whole would shrink it to a small motif in the middle of its box.

       The reach is taken from the GROUP and not from one geometry, because half
       the catalogue is composite: a globe's ring is wider than its dots, and a
       bound read off the dots would have cut the ring — the defect this whole
       block exists to stop, one object further out. */
    var fitRadius = 0;
    if (scene.fits) {
      for (var ki = 0; ki < group.children.length; ki++) {
        var child = group.children[ki];
        if (!child.geometry) continue;
        try { child.geometry.computeBoundingSphere(); } catch (e) {}
        var bs = child.geometry.boundingSphere;
        if (!bs) continue;
        var sc = Math.max(child.scale.x, child.scale.y, child.scale.z);
        var far = child.position.length() + (bs.center.length() + bs.radius) * sc;
        if (far > fitRadius) fitRadius = far;
      }
    }

    var keyLight = null;
    if (scene.lit) {
      scene3.add(new THREE.AmbientLight(0xffffff, 1.1));
      keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
      keyLight.position.set(2.5, 3, 2.5);
      scene3.add(keyLight);
    }

    function size() {
      if (!renderer || !node) return;
      var w = Math.max(1, node.clientWidth), h = Math.max(1, node.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      /* The box decides the distance, not the other way round: a scene put in a
         tall column is the same object seen from further away, never the same
         object with its sides cut off. */
      if (fitRadius) camera.position.z = mockySceneReach(fitRadius, camera.fov, camera.aspect);
      camera.updateProjectionMatrix();
    }

    function draw(t) {
      if (!renderer) return;
      /* A sway and not a spin, for a body made of flat faces: see the stack. */
      group.rotation.y = scene.sway
        ? Math.sin(t * 0.45 * speed) * scene.sway
        : t * scene.spin * speed;
      group.position.y = scene.bob ? Math.sin(t * 0.9 * speed) * 0.06 * scene.bob : 0;
      /* The floor travels and wraps on one row, so there is no seam to see. */
      if (drift) drift.position.z = (t * 0.5 * speed) % driftSpan;
      /* Towards the cursor, and with the page — added to the base movement, not
         instead of it, and eased so that a pointer jump is not an object jump. */
      lookX += (aimX - lookX) * MOCKY_LOOK_EASE;
      lookY += (aimY - lookY) * MOCKY_LOOK_EASE;
      lookScroll += (scrollAim - lookScroll) * MOCKY_LOOK_EASE;
      group.rotation.y += lookX * MOCKY_LOOK_YAW;
      group.rotation.x = lookY * MOCKY_LOOK_PITCH + lookScroll * MOCKY_SCROLL_TILT;
      /* A turn is invisible on a SPHERE, which is the preset a page reaches for
         first: a ball rotated ten degrees is the same ball. So the answer is
         three things at once — the body turns, the camera slides (a real
         parallax, which every body shows, fields included), and the key light
         travels so the highlight sweeps across a surface that has no features
         to turn. The slide is kept inside the framing margin: at tangency the
         slack is about 0.074 of the half-angle and this spends 0.046 of it, so
         an object that fits still fits while it answers. */
      var slide = (fitRadius || 1.6) * MOCKY_LOOK_SLIDE;
      camera.position.x = lookX * slide;
      camera.position.y = -lookY * slide;
      if (keyLight) keyLight.position.set(2.5 + lookX * 1.8, 3 - lookY * 1.8, 2.5);
      if (wavePos) {
        for (var i = 0; i < wavePos.count; i++) {
          var x = waveBase[i * 3], y = waveBase[i * 3 + 1];
          wavePos.setZ(i, Math.sin(x * 1.1 + t * speed) * 0.18 + Math.cos(y * 1.3 - t * 0.7 * speed) * 0.12);
        }
        wavePos.needsUpdate = true;
        waveGeom.computeVertexNormals();
      }
      renderer.render(scene3, camera);
      drew = true;
    }

    /* The last frame, kept as an image before the context goes away. Captured in
       the same turn as a render, which is what lets it work without
       preserveDrawingBuffer — a buffer kept alive for every scene on the canvas
       is memory nobody asked for.

       Two things learned by measuring it. A still is only kept when a frame was
       really DRAWN at a real size: a scene revoked before its first paint
       produced a transparent 282-byte PNG, and since a poster replaces the
       gradient, the calm fallback became an empty hole. And the encode is
       BOUNDED — toDataURL on a hero-sized buffer (2880x1440) costs 35 ms of the
       main thread, which is a dropped frame per scene every time a pan changes
       who holds the budget. A capture frame is the one place that pays full
       price: it happens once, offscreen, and the picture IS the product. */
    function keepStill() {
      if (!renderer || !drew) return;
      var src = renderer.domElement;
      if (src.width < 2 || src.height < 2) return;
      try {
        draw(elapsed());
        var out = src;
        var k = stillOnly ? 1 : Math.min(1, 640 / Math.max(src.width, src.height));
        if (k < 1) {
          out = document.createElement('canvas');
          out.width = Math.max(1, Math.round(src.width * k));
          out.height = Math.max(1, Math.round(src.height * k));
          out.getContext('2d').drawImage(src, 0, 0, out.width, out.height);
        }
        setPoster(out.toDataURL('image/png'));
      } catch (e) {}
    }

    function stop(keep) {
      /* A scene with no context has nothing to answer with, and a listener left
         on window would be one per screen on the canvas, forever. */
      deafen();
      if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
      if (!renderer) return;
      if (keep) keepStill();
      try { renderer.forceContextLoss(); } catch (e) {}
      try { renderer.dispose(); } catch (e) {}
      if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      renderer = null;
    }

    function loop() {
      if (disposed || !renderer) return;
      draw(elapsed());
      raf = window.requestAnimationFrame(loop);
    }

    function start() {
      /* settled is how the one-frame path stays one frame: without it every
         grant, resize or visibility event would build a renderer again to draw
         the same image. */
      if (disposed || renderer || settled || !granted || !visible) return;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      } catch (e) { renderer = null; return; }
      /* Capped at 2: a retina canvas costs four times the pixels for a
         decoration, and the whole canvas pays for it at once. */
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearAlpha(0);
      renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
      node.appendChild(renderer.domElement);
      renderer.domElement.addEventListener('webglcontextlost', function (e) {
        e.preventDefault();
        stop(false);
      });
      size();
      setPoster(null);
      /* One frame, then the context back. The scene is still THERE — it is the
         image of itself — and the slot returns to the budget for a screen that
         is going to move. */
      if (reduced || stillOnly) { owe(true); settle(); if (!settled) ladder(); return; }
      listen();
      loop();
    }

    /**
     * Trying again, a few times, for the frame that has to be right.
     *
     * Two things can put a real size after the first effect: Tailwind's runtime
     * applies a class once it has parsed the document, and a ResizeObserver is
     * delivered with a rendering frame — which an offscreen capture iframe may
     * be slow to get. Either way the still would have been taken of a 1x1
     * canvas and refused. A short ladder is what makes the one frame arrive
     * anyway; it stops at the first success, and at six tries regardless.
     */
    function ladder() {
      var tries = 0;
      ladderTimer = window.setInterval(function () {
        settle();
        if (settled || ++tries > 5) { window.clearInterval(ladderTimer); ladderTimer = 0; owe(false); }
      }, 60);
    }

    /**
     * The one frame, taken once the element has a SIZE.
     *
     * Tailwind's JIT runtime applies a class after the first paint, so an
     * effect that fires on mount measures a box of 0x0: the still came back a
     * 1x1 canvas, keepStill refused it, and a captured screen kept showing the
     * fallback gradient. The live path never noticed — its ResizeObserver
     * resizes the canvas and the loop redraws — so the wait belongs here, where
     * there is only ever one frame to get right.
     */
    function settle() {
      if (settled || !renderer || !node) return;
      if (node.clientWidth < 2 || node.clientHeight < 2) return;
      settled = true;
      size();
      draw(0);
      keepStill();
      stop(false);
      owe(false);
    }

    function grantChanged() {
      granted = window.__mockyGL !== false;
      if (granted) start(); else stop(true);
    }

    /**
     * The cursor and the scroll, damped.
     *
     * The first ten scenes turned at a constant rate and nothing else, which is
     * what a screensaver does: the page moved and the object did not notice.
     * These two inputs are what make it read as an object in the room rather
     * than a loop playing in a box — and both are tiny (see the constants),
     * because a decoration that answers too eagerly has stopped being one.
     *
     * The pointer is read from WINDOW and not from the element: the usual shape
     * is a scene behind a headline, so the cursor is over the text nine times
     * out of ten and an element listener would never fire. The element's box is
     * cached and re-measured on scroll and on resize, so no frame reads layout.
     *
     * A scene that must hold still — a capture, prefers-reduced-motion, the
     * Sans animation switch — attaches none of this.
     */
    var aimX = 0, aimY = 0, lookX = 0, lookY = 0, scrollAim = 0, lookScroll = 0;
    var box = null;

    function measure() {
      try { box = node.getBoundingClientRect(); } catch (e) { box = null; }
      if (box && box.height) scrollAim = mockySceneScroll(box, window.innerHeight || 1);
    }

    function onPointer(e) {
      if (!box || !box.width || !box.height) return;
      aimX = Math.max(-1, Math.min(1, ((e.clientX - box.left) / box.width - 0.5) * 2));
      aimY = Math.max(-1, Math.min(1, ((e.clientY - box.top) / box.height - 0.5) * 2));
    }

    var listening = false;
    function listen() {
      if (listening || reduced || stillOnly) return;
      listening = true;
      measure();
      window.addEventListener('pointermove', onPointer, { passive: true });
      window.addEventListener('scroll', measure, { passive: true });
      window.addEventListener('resize', measure, { passive: true });
    }
    function deafen() {
      if (!listening) return;
      listening = false;
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    }

    var io = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          visible = entries[i].isIntersecting;
        }
        if (visible) start(); else stop(true);
      }, { rootMargin: '120px' });
      io.observe(node);
    }

    var ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(function () { size(); measure(); if (reduced || stillOnly) settle(); });
      ro.observe(node);
    }
    function onHidden() { if (document.hidden) stop(true); else start(); }
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('mocky:gl', grantChanged);
    start();

    return function () {
      disposed = true;
      if (rationed) mockySceneRelease();
      deafen();
      owe(false);
      if (ladderTimer) window.clearInterval(ladderTimer);
      window.removeEventListener('mocky:gl', grantChanged);
      document.removeEventListener('visibilitychange', onHidden);
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      stop(false);
      for (var oi = 0; oi < owned.length; oi++) {
        try { owned[oi].dispose(); } catch (e) {}
      }
    };
  }, [preset, color, accent, speed]);

  /**
   * Who positions this element.
   *
   * position: relative was written inline, and an inline rule beats a class:
   * a model that wrote the most natural thing in the world for a hero —
   * <Scene3D className="absolute inset-0" /> behind its words — got an element
   * forced back into the flow, where inset-0 means nothing and the height is
   * the height of its absolutely-positioned contents, i.e. ZERO. The scene was
   * invisible and still held a WebGL context. So the inline rule is a DEFAULT
   * now: it applies only when nothing else positions the element, because the
   * canvas inside needs a containing block and a bare div has none.
   */
  var positioned = /(^|\\s)(absolute|fixed|sticky|relative)(\\s|$)/.test(props.className || '') ||
    !!(props.style && props.style.position);

  /**
   * A scene taken OUT of the flow is a backdrop, and a backdrop stays behind.
   *
   * The card teaches two shapes and they are not equally safe: a sized box
   * beside the text has nothing over it, while a scene at absolute inset-0 has
   * the headline standing ON it — and nothing in a page measures the contrast
   * of a moving pixel, which is exactly the work Motion does with its palettes
   * and a page cannot. So the backdrop shape is drawn quieter: the object is
   * still there, the words on it stay readable, and a model that forgot the
   * veil the card asks for does not ship white on bright indigo.
   *
   * Only absolute and fixed. relative and sticky are still in the flow — a
   * subject with a size, not a surface under something else — and dimming those
   * would punish the ordinary case. An opacity class wins, for the reason the
   * position above does: a model that said what it wanted said it.
   */
  var backdrop = /(^|\\s)(absolute|fixed)(\\s|$)/.test(props.className || '');
  var dimmed = /(^|\\s)-?opacity-/.test(props.className || '') ||
    !!(props.style && props.style.opacity !== undefined);


  return React.createElement(
    'div',
    {
      className: props.className,
      /* The still lives UNDER the canvas rather than instead of it: when a
         context is taken back mid-scene the canvas simply stops painting, and
         what shows through is the frame it stopped on. The gradient stays under
         both, so a still with transparency in it is still a calm surface. */
      style: Object.assign(
        {
          position: positioned ? undefined : 'relative',
          opacity: backdrop && !dimmed ? 0.62 : undefined,
          /* Decorative and aria-hidden both: it must never take a click meant
             for the section it sits under. The pointer is read from window, so
             nothing here needs the events. */
          pointerEvents: 'none',
          overflow: 'hidden',
          /* An IMAGE, not the background shorthand: the shorthand resets
             background-color, so a scene the page gave a bg-slate-950 came out
             transparent and the gradient was read over the page's white. The
             fallback belongs OVER whatever colour the page chose. */
          backgroundImage: mockySceneStill(color),
        },
        props.style || {},
      ),
      'aria-hidden': 'true',
    },
    posterUrl
      ? React.createElement('img', {
          ref: stillRef,
          src: posterUrl,
          alt: '',
          style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
        })
      : null,
    React.createElement('div', { ref: host, style: { position: 'absolute', inset: 0 } }),
  );
}`

export const SCENE3D_EXPORTS = ['Scene3D'] as const

/**
 * The closed vocabulary, restated for the prompt and for tests.
 *
 * Next to the source rather than derived from it, exactly as `ANIMATE_PRESETS`
 * is: the registry's card for this capability quotes these names, the tests
 * hold the two lists to one, and a preset added to the source without a word
 * here would be a scene nobody can ask for.
 */
export const SCENE3D_PRESETS = [
  'orb',
  'solid',
  'crystal',
  'ring',
  'globe',
  'stack',
  'bubbles',
  'particles',
  'grid',
  'wave',
] as const
export const SCENE3D_SPEEDS = ['slow', 'medium', 'fast'] as const
