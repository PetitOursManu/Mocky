/**
 * MotionFilm — a rendered Motion film, playing inside a generated screen.
 *
 * The component the model is given once Motion has actually produced a film for
 * the screen. Unlike `ScrollSequence`, which draws JPEGs onto a canvas, this one
 * IS a <video>: the film is a single .mp4 in the export store, and cutting it
 * into stills to avoid a media source would pay for the cutting twice and lose
 * the encoder's whole point.
 *
 * WHY IT CAN LOAD AT ALL
 *
 * The preview iframe is `sandbox="allow-scripts"` with no `allow-same-origin`
 * (I2, I3), so its document has an opaque origin and cannot authenticate
 * anything it fetches. `GET /api/video/<hash>` is therefore public by hash — the
 * same trade `/api/images/:hash` and the clip library already make, argued at
 * its mount in `server/index.js`. Without that, this component could exist and
 * would render a black rectangle.
 *
 * WHY MUTED AND WHY autoPlay SURVIVES
 *
 * There is no audio in a Motion film — the schema has no field for one and says
 * so. `muted` is still written, and not as decoration: every browser refuses to
 * autoplay a video that is not muted, so an unmuted tag is a film that never
 * starts. `playsInline` is the same class of thing on iOS, where the default is
 * to take the video fullscreen.
 *
 * WHY IT IS NOT ALWAYS A HERO
 *
 * `fit` and the caller's own classes decide the size. A film is as legitimate
 * behind a hero as it is in a product card, a banner strip or a section
 * background, and the signature was written so the small cases need no more
 * ceremony than the large one: drop it in a sized box and it fills it.
 *
 * `overlay` exists because a film used as a BACKGROUND needs its content to sit
 * on top, and a generated screen that positions its own overlay gets the
 * stacking wrong about half the time. Passing children puts them in a centred
 * layer above the video, with the film behind them.
 *
 * Exported as a STRING so it can be prepended to the generated component before
 * Babel.transform, like every other snippet pack.
 */
export const MotionFilmSource = `var MotionFilm = function (props) {
  var src = String(props.src || '');
  var fit = props.fit === 'contain' ? 'contain' : 'cover';
  var radius = props.radius === undefined ? 0 : parseInt(props.radius, 10) || 0;
  var loop = props.loop === false ? false : true;
  var hasOverlay = props.children !== undefined && props.children !== null;

  if (!src) return null;

  var video = React.createElement('video', {
    src: src,
    autoPlay: true,
    muted: true,
    loop: loop,
    playsInline: true,
    // No controls: a film in a mockup is a moving picture, not a player. A
    // control bar drawn over a hero is the single fastest way to make a
    // generated screen look like a bug report.
    controls: false,
    style: {
      position: hasOverlay ? 'absolute' : 'relative',
      inset: hasOverlay ? 0 : undefined,
      width: '100%',
      height: '100%',
      objectFit: fit,
      display: 'block',
      borderRadius: radius ? radius + 'px' : undefined,
    },
  });

  if (!hasOverlay) return video;

  return React.createElement(
    'div',
    { style: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: radius ? radius + 'px' : undefined } },
    video,
    React.createElement(
      'div',
      {
        style: {
          position: 'relative',
          zIndex: 1,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        },
      },
      props.children,
    ),
  );
};`

export const MOTIONFILM_EXPORTS = ['MotionFilm'] as const
