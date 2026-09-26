/**
 * ScrollSequence — a clip that advances with the scroll wheel.
 *
 * The component the model is given when Muse has produced a video for the
 * screen. It never receives a video file: the server cut the clip into JPEGs
 * (see server/videos/frames.js), so this draws pictures onto a canvas and the
 * sandboxed preview needs no media source at all.
 *
 * HOW THE PINNING WORKS
 *
 * The outer element is tall — `height` viewport-heights of scroll travel — and
 * the canvas inside it is `position: sticky`, so it stays fixed on screen while
 * that travel is consumed. Progress through the travel picks the frame. Scroll
 * up and the clip runs backwards, which is the whole point and the reason this
 * cannot be a <video> playing on autoplay.
 *
 * WHY NEAREST-LOADED RATHER THAN WAIT-FOR-ALL
 *
 * Sixty frames are sixty requests. Blocking the section until the last one
 * lands would show a hole for a second or two on a cold cache; blocking until
 * the FIRST one lands and then drawing the nearest frame already decoded means
 * the sequence is usable immediately and simply sharpens as it fills in.
 *
 * Exported as a STRING so it can be prepended to the generated component before
 * Babel.transform, like every other snippet pack.
 *
 * PointerSequence, further down, is the same cut clip driven by the cursor
 * instead of the scroll — a face that follows the pointer, an object that turns
 * as the mouse crosses the page. It shares the loader and the painter below and
 * nothing else: what picks the frame is the whole difference between the two.
 */
export const ScrollVideoSource = `/* The nearest frame already decoded to the one wanted, or -1 when none is.
   Walks outwards, so a cold cache shows a neighbour rather than a hole. */
function mockySeqPick(loaded, want) {
  if (!loaded || !loaded.length) return -1;
  if (loaded[want]) return want;
  for (var d = 1; d < loaded.length; d++) {
    if (loaded[want - d]) return want - d;
    if (loaded[want + d]) return want + d;
  }
  return -1;
}

/* One frame onto the canvas, cover or contain, at the device pixel ratio
   (capped at 2: a 3x buffer is nine times the pixels for no visible gain). */
function mockySeqPaint(canvas, img, fit) {
  if (!canvas || !img || !img.naturalWidth) return;
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var w = canvas.clientWidth || 1;
  var h = canvas.clientHeight || 1;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var scale = fit === 'contain'
    ? Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight)
    : Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
  var dw = img.naturalWidth * scale;
  var dh = img.naturalHeight * scale;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
}

/* Starts every frame loading at once and calls onFrame as each one lands:
   the first fills the empty canvas, later ones replace whatever neighbour was
   standing in for them. cancel() silences a set a newer clip has replaced. */
function mockySeqLoad(base, total, onFrame) {
  var cancelled = false;
  var images = new Array(total);
  var loaded = new Array(total);
  for (var i = 0; i < total; i++) {
    (function (slot) {
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () {
        if (cancelled) return;
        loaded[slot] = true;
        onFrame(slot);
      };
      im.src = base + '/f/' + (slot + 1) + '.jpg';
      images[slot] = im;
    })(i);
  }
  return { images: images, loaded: loaded, cancel: function () { cancelled = true; } };
}

var ScrollSequence = function (props) {
  var base = String(props.base || '');
  var total = Math.max(0, parseInt(props.frames, 10) || 0);
  var travel = Math.max(120, parseInt(props.height, 10) || 300);
  var fit = props.fit === 'contain' ? 'contain' : 'cover';
  var wrapRef = React.useRef(null);
  var canvasRef = React.useRef(null);
  var imagesRef = React.useRef([]);
  var loadedRef = React.useRef([]);
  var rafRef = React.useRef(0);
  var lastRef = React.useRef(-1);

  var pickLoaded = function (want) { return mockySeqPick(loadedRef.current, want); };
  var paint = function (index) { mockySeqPaint(canvasRef.current, imagesRef.current[index], fit); };

  var update = function () {
    var wrap = wrapRef.current;
    if (!wrap || !total) return;
    var rect = wrap.getBoundingClientRect();
    var span = rect.height - window.innerHeight;
    var progress = span > 0 ? (-rect.top) / span : 0;
    progress = progress < 0 ? 0 : progress > 1 ? 1 : progress;
    var want = Math.round(progress * (total - 1));
    var index = pickLoaded(want);
    if (index < 0 || index === lastRef.current) return;
    lastRef.current = index;
    paint(index);
  };

  // The slot is claimed BEFORE asking for the frame, and released inside the
  // callback. Written the other way round — rafRef.current = rAF(update) — the
  // release inside update() happens first and the assignment then puts the
  // marker back, so the guard latches and nothing ever repaints again. Real
  // browsers run the callback later and hide it; anything that runs it inline
  // does not.
  var schedule = function () {
    if (rafRef.current) return;
    rafRef.current = 1;
    window.requestAnimationFrame(function () {
      rafRef.current = 0;
      update();
    });
  };

  React.useEffect(function () {
    if (!base || !total) return;
    var set = mockySeqLoad(base, total, function () {
      lastRef.current = -1;
      schedule();
    });
    imagesRef.current = set.images;
    loadedRef.current = set.loaded;
    lastRef.current = -1;
    return set.cancel;
  }, [base, total]);

  React.useEffect(function () {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return function () {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [total]);

  return React.createElement('section', {
    ref: wrapRef,
    className: props.className || '',
    style: { position: 'relative', height: travel + 'vh' },
  },
    React.createElement('div', {
      style: { position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' },
    },
      React.createElement('canvas', {
        ref: canvasRef,
        'aria-hidden': 'true',
        style: { display: 'block', width: '100%', height: '100%', background: props.background || '#000' },
      }),
      props.children
        ? React.createElement('div', {
            style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
          }, props.children)
        : null
    )
  );
};

/* How far the drawn position closes on the pointer per animation frame.
   Jumping straight to the frame under the cursor reads as a slideshow on a
   clip of 60 stills; closing a fifth of the gap each frame turns the same
   stills into a head that TURNS, and settles in about a third of a second. */
var MOCKY_SEQ_FOLLOW = 0.2;

/* Where the clip rests when no pointer is steering it: before the first move,
   after the pointer leaves the page, and for good when motion is held. A face
   at rest looks straight ahead, so the default is the middle. */
function mockySeqRest(rest) {
  if (rest === 'start') return { u: 0, v: 0 };
  if (rest === 'end') return { u: 1, v: 1 };
  return { u: 0.5, v: 0.5 };
}

/* Which frame (0-based) a pointer position picks. u and v run 0..1 across the
   tracked box, left to right and top to bottom.

   Without a map, one axis sweeps the whole clip. With one, the box is cut into
   a grid — rows top to bottom, cells left to right — and each cell names the
   frame to show, counted from 1 like the files on disk. That is the shape of a
   "gaze" table: a clip that looks left, right, up and down in some order only
   its author knows, and a grid that says which moment looks where. A flat list
   is one row. A cell that names no frame falls back to the axis rather than
   to a black canvas. */
function mockySeqFrame(u, v, total, map, axis, reverse) {
  if (!(total > 0)) return -1;
  u = u > 0 ? (u < 1 ? u : 1) : 0;
  v = v > 0 ? (v < 1 ? v : 1) : 0;
  var grid = Array.isArray(map) && map.length ? (Array.isArray(map[0]) ? map : [map]) : null;
  if (grid) {
    var line = grid[Math.min(grid.length - 1, Math.floor(v * grid.length))];
    if (Array.isArray(line) && line.length) {
      var n = parseInt(line[Math.min(line.length - 1, Math.floor(u * line.length))], 10);
      if (n >= 1) return Math.min(total, n) - 1;
    }
  }
  var t = axis === 'y' ? v : u;
  if (reverse) t = 1 - t;
  return Math.round(t * (total - 1));
}

/* Held still: a capture, the "Sans animation" switch, or a visitor who asked
   for reduced motion. A clip that follows the cursor is interaction-driven
   motion, which is exactly what reduced motion asks to be spared; it rests. */
function mockySeqHeld() {
  try {
    if (window.__mockyStill) return true;
    if (window.__mockyAnimations === false) return true;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch (e) { return true; }
  return false;
}

/**
 * PointerSequence — the cut clip, steered by the cursor.
 *
 * A BOX, not a section: it fills whatever the page gives it and lays its
 * children on top, so it can be a footer's background, a hero or a card. With
 * children and no height of its own it is as tall as its content, which is
 * what a footer wants; with neither it keeps 240px rather than collapsing to
 * nothing.
 *
 * The pointer is read from the WINDOW by default, because the effect this was
 * written for — eyes that follow the cursor — has to answer a pointer anywhere
 * on the page, not only one that happens to be over the picture. track="self"
 * restricts it to the box and rests when the pointer leaves it.
 *
 * Settings are read through a ref from the listeners, so a parent re-rendering
 * with a new map literal every time does not re-subscribe anything.
 */
var PointerSequence = function (props) {
  var base = String(props.base || '');
  var total = Math.max(0, parseInt(props.frames, 10) || 0);
  var wrapRef = React.useRef(null);
  var canvasRef = React.useRef(null);
  var imagesRef = React.useRef([]);
  var loadedRef = React.useRef([]);
  var lastRef = React.useRef(-1);
  var rafRef = React.useRef(0);
  var frameIdRef = React.useRef(0);
  var cfgRef = React.useRef(null);
  cfgRef.current = {
    fit: props.fit === 'contain' ? 'contain' : 'cover',
    axis: props.axis === 'y' ? 'y' : 'x',
    track: props.track === 'self' ? 'self' : 'window',
    map: props.map,
    reverse: !!props.reverse,
    rest: mockySeqRest(props.rest),
  };
  var posRef = React.useRef(null);
  var targetRef = React.useRef(null);
  if (!posRef.current) {
    posRef.current = mockySeqRest(props.rest);
    targetRef.current = mockySeqRest(props.rest);
  }

  var draw = function () {
    var cfg = cfgRef.current;
    var p = posRef.current;
    var index = mockySeqPick(loadedRef.current, mockySeqFrame(p.u, p.v, total, cfg.map, cfg.axis, cfg.reverse));
    if (index < 0 || index === lastRef.current) return;
    lastRef.current = index;
    mockySeqPaint(canvasRef.current, imagesRef.current[index], cfg.fit);
  };

  var tick = function () {
    var p = posRef.current;
    var t = targetRef.current;
    p.u += (t.u - p.u) * MOCKY_SEQ_FOLLOW;
    p.v += (t.v - p.v) * MOCKY_SEQ_FOLLOW;
    if (Math.abs(t.u - p.u) < 0.002 && Math.abs(t.v - p.v) < 0.002) {
      p.u = t.u;
      p.v = t.v;
    } else {
      schedule();
    }
    draw();
  };

  // Claimed before asking, released inside the callback: see ScrollSequence.
  // The id is kept apart from the claim so unmounting can cancel a real frame.
  var schedule = function () {
    if (rafRef.current) return;
    rafRef.current = 1;
    frameIdRef.current = window.requestAnimationFrame(function () {
      rafRef.current = 0;
      tick();
    });
  };

  var aim = function (u, v) {
    targetRef.current = { u: u, v: v };
    schedule();
  };
  var toRest = function () {
    var r = cfgRef.current.rest;
    aim(r.u, r.v);
  };

  React.useEffect(function () {
    if (!base || !total) return;
    var set = mockySeqLoad(base, total, function () {
      lastRef.current = -1;
      draw();
    });
    imagesRef.current = set.images;
    loadedRef.current = set.loaded;
    lastRef.current = -1;
    return set.cancel;
  }, [base, total]);

  React.useEffect(function () {
    var onMove = function (e) {
      if (mockySeqHeld()) return;
      if (cfgRef.current.track === 'self') {
        var el = wrapRef.current;
        if (!el) return;
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return toRest();
        return aim((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      }
      aim(e.clientX / (window.innerWidth || 1), e.clientY / (window.innerHeight || 1));
    };
    // relatedTarget is null only when the pointer left the document itself —
    // for a preview, when it left the iframe.
    var onOut = function (e) { if (!e.relatedTarget) toRest(); };
    // A finger has no hover: when it lifts, nothing is steering any more.
    var onUp = function (e) { if (e.pointerType === 'touch') toRest(); };
    var onResize = function () {
      lastRef.current = -1;
      draw();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('blur', toRest);
    window.addEventListener('resize', onResize);
    document.addEventListener('mouseout', onOut);
    return function () {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('blur', toRest);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('mouseout', onOut);
      if (rafRef.current) window.cancelAnimationFrame(frameIdRef.current);
      rafRef.current = 0;
    };
  }, [total]);

  return React.createElement('div', {
    ref: wrapRef,
    className: props.className || '',
    style: {
      position: 'relative',
      overflow: 'hidden',
      minHeight: props.children ? undefined : 240,
      background: props.background || '#000',
    },
  },
    React.createElement('canvas', {
      ref: canvasRef,
      'aria-hidden': 'true',
      style: { position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%' },
    }),
    props.children
      ? React.createElement('div', { style: { position: 'relative', zIndex: 1, height: '100%' } }, props.children)
      : null
  );
};`

export const SCROLLVIDEO_EXPORTS = ['ScrollSequence', 'PointerSequence'] as const
