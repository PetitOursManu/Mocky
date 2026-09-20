// The bundler's entry point. Nothing in Node ever imports this file — it is
// compiled by `bundle()` in render.js and executed inside Chromium.
import { registerRoot } from 'remotion'
import { RemotionRoot } from './Root.jsx'

registerRoot(RemotionRoot)
