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
  orb: { body: 'sphere', lit: true, spin: 0.35, bob: 0.4 },
  solid: { body: 'knot', lit: true, spin: 0.55, bob: 0.2 },
  crystal: { body: 'crystal', lit: true, spin: 0.4, bob: 0.3 },
  ring: { body: 'torus', lit: true, spin: 0.6, bob: 0.15 },
  particles: { body: 'points', lit: false, spin: 0.12, bob: 0 },
  wave: { body: 'wave', lit: true, spin: 0.08, bob: 0 }
};

var MOCKY_SCENE_SPEED = { slow: 0.55, medium: 1, fast: 1.7 };

/** A hex the palette can be measured through, or the house ink. Never a string from a model, unchecked. */
function mockySceneColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3}([0-9a-fA-F]{2})?)?$/.test(value.trim())
    ? value.trim()
    : '#6366f1';
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
  var color = mockySceneColor(props.color);
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

    var renderer = null, raf = 0, disposed = false, visible = true, granted = window.__mockyGL !== false;
    var clock = new THREE.Clock();
    var scene3 = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 4.2);
    var group = new THREE.Group();
    scene3.add(group);

    var col = new THREE.Color(color);
    var material = scene.lit
      ? new THREE.MeshStandardMaterial({ color: col, roughness: 0.32, metalness: 0.15 })
      : new THREE.MeshBasicMaterial({ color: col });
    var geometry = null, object = null, wavePos = null, waveBase = null;

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
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      object = new THREE.Points(geometry, new THREE.PointsMaterial({ color: col, size: 0.035, transparent: true, opacity: 0.85 }));
    } else if (scene.body === 'wave') {
      geometry = new THREE.PlaneGeometry(6, 4, 48, 32);
      object = new THREE.Mesh(geometry, material);
      object.rotation.x = -1.05;
      object.position.y = -0.4;
      wavePos = geometry.getAttribute('position');
      waveBase = Float32Array.from(wavePos.array);
    } else {
      geometry =
        scene.body === 'knot' ? new THREE.TorusKnotGeometry(1, 0.34, 120, 20)
        : scene.body === 'torus' ? new THREE.TorusGeometry(1.15, 0.32, 24, 96)
        : scene.body === 'crystal' ? new THREE.IcosahedronGeometry(1.35, 0)
        : new THREE.SphereGeometry(1.35, 48, 32);
      object = new THREE.Mesh(geometry, material);
    }
    group.add(object);

    if (scene.lit) {
      scene3.add(new THREE.AmbientLight(0xffffff, 1.1));
      var key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(2.5, 3, 2.5);
      scene3.add(key);
    }

    function size() {
      if (!renderer || !node) return;
      var w = Math.max(1, node.clientWidth), h = Math.max(1, node.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function draw(t) {
      if (!renderer) return;
      group.rotation.y = t * scene.spin * speed;
      group.position.y = scene.bob ? Math.sin(t * 0.9 * speed) * 0.06 * scene.bob : 0;
      if (wavePos) {
        for (var i = 0; i < wavePos.count; i++) {
          var x = waveBase[i * 3], y = waveBase[i * 3 + 1];
          wavePos.setZ(i, Math.sin(x * 1.1 + t * speed) * 0.18 + Math.cos(y * 1.3 - t * 0.7 * speed) * 0.12);
        }
        wavePos.needsUpdate = true;
        geometry.computeVertexNormals();
      }
      renderer.render(scene3, camera);
    }

    /* The last frame, kept as an image before the context goes away. Captured in
       the same turn as a render, which is what lets it work without
       preserveDrawingBuffer — a buffer kept alive for every scene on the canvas
       is memory nobody asked for. */
    function keepStill() {
      if (!renderer) return;
      try {
        draw(clock.getElapsedTime());
        setPoster(renderer.domElement.toDataURL('image/png'));
      } catch (e) {}
    }

    function stop(keep) {
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
      draw(clock.getElapsedTime());
      raf = window.requestAnimationFrame(loop);
    }

    function start() {
      if (disposed || renderer || !granted || !visible) return;
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
      if (reduced) { draw(0); return; }
      loop();
    }

    function grantChanged() {
      granted = window.__mockyGL !== false;
      if (granted) start(); else stop(true);
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
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(size); ro.observe(node); }
    function onHidden() { if (document.hidden) stop(true); else start(); }
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('mocky:gl', grantChanged);
    start();

    return function () {
      disposed = true;
      window.removeEventListener('mocky:gl', grantChanged);
      document.removeEventListener('visibilitychange', onHidden);
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      stop(false);
      if (geometry) geometry.dispose();
      if (material) material.dispose();
    };
  }, [preset, color, speed]);

  return React.createElement(
    'div',
    {
      className: props.className,
      /* The still lives UNDER the canvas rather than instead of it: when a
         context is taken back mid-scene the canvas simply stops painting, and
         what shows through is the frame it stopped on. */
      style: Object.assign(
        { position: 'relative', overflow: 'hidden', background: posterUrl ? undefined : mockySceneStill(color) },
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
export const SCENE3D_PRESETS = ['orb', 'solid', 'crystal', 'ring', 'particles', 'wave'] as const
export const SCENE3D_SPEEDS = ['slow', 'medium', 'fast'] as const
