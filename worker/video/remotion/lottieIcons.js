// The animated icons, by the name a film writes — and the animation behind each.
//
// The animations are `react-useanimations` (MIT), bundled as JSON with the worker
// and never fetched: the fonts' rule, for the fonts' reason. Only the data is
// read — none of the library's React components — and every colour in it is
// replaced before it is drawn (`recolourLottie` in `blocks/media.js`).
//
// The NAMES are the schema's (`ICON_NAMES`, in the three readers), chosen for a
// model to pick by meaning: `bell` rather than `notification2`, `like` rather than
// `thumbUp`. `tests/video-icons.test.js` holds this table and the enum to one list,
// in both directions — an icon the model may name and the worker cannot draw is a
// film refused half a minute into its render.
//
// `mode` is how the icon moves across a scene (`iconFrame`): `loop` for the ones
// that are a motion — a spinner, a pulse, an arrow bobbing — and `toggle` for the
// gestures between two states.
//
// A toggle also says where its IDENTITY is, and a rendered probe sheet is why.
// Half the library DRAWS something — a tick, a filled heart, a bookmark — and
// resting at the end of that gesture is the icon. The other half ends on a
// NEGATION: a crossed-out bell, a muted microphone, a magnifier that becomes an
// X. Left to rest there, each of those spent its whole scene saying the opposite
// of the word under it. Those carry `rest: 'start'` — they visit and come back —
// and a `to` that stops the visit before the negation is even drawn.

import activity from 'react-useanimations/lib/activity/activity.json'
import alertCircle from 'react-useanimations/lib/alertCircle/alertCircle.json'
import arrowDown from 'react-useanimations/lib/arrowDown/arrowDown.json'
import arrowUp from 'react-useanimations/lib/arrowUp/arrowUp.json'
import arrowRightCircle from 'react-useanimations/lib/arrowRightCircle/arrowRightCircle.json'
import bookmark from 'react-useanimations/lib/bookmark/bookmark.json'
import calendar from 'react-useanimations/lib/calendar/calendar.json'
import checkmark from 'react-useanimations/lib/checkmark/checkmark.json'
import checkBox from 'react-useanimations/lib/checkBox/checkBox.json'
import edit from 'react-useanimations/lib/edit/edit.json'
import explore from 'react-useanimations/lib/explore/explore.json'
import folder from 'react-useanimations/lib/folder/folder.json'
import heart from 'react-useanimations/lib/heart/heart.json'
import home from 'react-useanimations/lib/home/home.json'
import infinity from 'react-useanimations/lib/infinity/infinity.json'
import loading from 'react-useanimations/lib/loading/loading.json'
import lock from 'react-useanimations/lib/lock/lock.json'
import mail from 'react-useanimations/lib/mail/mail.json'
import menu from 'react-useanimations/lib/menu/menu.json'
import microphone from 'react-useanimations/lib/microphone/microphone.json'
import notification from 'react-useanimations/lib/notification/notification.json'
import playPause from 'react-useanimations/lib/playPause/playPause.json'
import scrollDown from 'react-useanimations/lib/scrollDown/scrollDown.json'
import searchToX from 'react-useanimations/lib/searchToX/searchToX.json'
import settings from 'react-useanimations/lib/settings/settings.json'
import share from 'react-useanimations/lib/share/share.json'
import star from 'react-useanimations/lib/star/star.json'
import thumbUp from 'react-useanimations/lib/thumbUp/thumbUp.json'
import userPlus from 'react-useanimations/lib/userPlus/userPlus.json'
import video from 'react-useanimations/lib/video/video.json'
import visibility from 'react-useanimations/lib/visibility/visibility.json'
import volume from 'react-useanimations/lib/volume/volume.json'
import zoomIn from 'react-useanimations/lib/zoomIn/zoomIn.json'
import download from 'react-useanimations/lib/download/download.json'

export const LOTTIE_ICONS = {
  pulse: { data: activity, mode: 'loop' },
  alert: { data: alertCircle, mode: 'toggle' },
  arrowDown: { data: arrowDown, mode: 'loop' },
  arrowUp: { data: arrowUp, mode: 'loop' },
  next: { data: arrowRightCircle, mode: 'toggle' },
  bookmark: { data: bookmark, mode: 'toggle' },
  calendar: { data: calendar, mode: 'toggle' },
  check: { data: checkmark, mode: 'toggle' },
  checkbox: { data: checkBox, mode: 'toggle' },
  edit: { data: edit, mode: 'toggle' },
  compass: { data: explore, mode: 'toggle' },
  folder: { data: folder, mode: 'toggle' },
  heart: { data: heart, mode: 'toggle' },
  home: { data: home, mode: 'toggle' },
  infinity: { data: infinity, mode: 'loop' },
  loading: { data: loading, mode: 'loop' },
  lock: { data: lock, mode: 'toggle', rest: 'start', to: 0.6 },
  mail: { data: mail, mode: 'toggle' },
  menu: { data: menu, mode: 'toggle', rest: 'start', to: 0.5 },
  microphone: { data: microphone, mode: 'toggle', rest: 'start', to: 0.45 },
  bell: { data: notification, mode: 'toggle', rest: 'start', to: 0.45 },
  play: { data: playPause, mode: 'toggle', rest: 'start', to: 0.5 },
  scroll: { data: scrollDown, mode: 'loop' },
  search: { data: searchToX, mode: 'toggle', rest: 'start', to: 0.4 },
  settings: { data: settings, mode: 'loop' },
  share: { data: share, mode: 'toggle' },
  star: { data: star, mode: 'toggle' },
  like: { data: thumbUp, mode: 'toggle' },
  userPlus: { data: userPlus, mode: 'toggle' },
  video: { data: video, mode: 'toggle', rest: 'start', to: 0.45 },
  eye: { data: visibility, mode: 'toggle', rest: 'start', to: 0.45 },
  volume: { data: volume, mode: 'toggle', rest: 'start', to: 0.45 },
  zoom: { data: zoomIn, mode: 'toggle', rest: 'start', to: 0.55 },
  download: { data: download, mode: 'toggle' },
}
