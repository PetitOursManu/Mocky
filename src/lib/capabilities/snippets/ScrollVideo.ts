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
 */
export const ScrollVideoSource = `var ScrollSequence = function (props) {
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

  var pickLoaded = function (want) {
    var loaded = loadedRef.current;
    if (!loaded.length) return -1;
    if (loaded[want]) return want;
    // Walk outwards from the wanted frame to the nearest one already decoded.
    for (var d = 1; d < loaded.length; d++) {
      if (loaded[want - d]) return want - d;
      if (loaded[want + d]) return want + d;
    }
    return -1;
  };

  var paint = function (index) {
    var canvas = canvasRef.current;
    if (!canvas) return;
    var img = imagesRef.current[index];
    if (!img || !img.naturalWidth) return;
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
  };

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
    var cancelled = false;
    var imgs = new Array(total);
    var loaded = new Array(total);
    imagesRef.current = imgs;
    loadedRef.current = loaded;
    lastRef.current = -1;
    for (var i = 0; i < total; i++) {
      (function (slot) {
        var im = new Image();
        im.decoding = 'async';
        im.onload = function () {
          if (cancelled) return;
          loaded[slot] = true;
          // Redraw whenever a frame lands: the first one fills the empty canvas,
          // and later ones replace whatever neighbour was standing in for them.
          lastRef.current = -1;
          schedule();
        };
        im.src = base + '/f/' + (slot + 1) + '.jpg';
        imgs[slot] = im;
      })(i);
    }
    return function () { cancelled = true; };
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
}`

export const SCROLLVIDEO_EXPORTS = ['ScrollSequence'] as const
