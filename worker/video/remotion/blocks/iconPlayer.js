// The door through which an animated icon is drawn — provided, never imported.
//
// `animatedIcon` needs a Lottie renderer and the library's animations, and
// neither may be imported under `blocks/`: `blocks/index.js` is loaded by
// Mocky's own suite, where no Lottie package is installed, and a single import
// would take the registry out of the test that proves it matches the schema.
// That is the argument `canvases.js` makes for the 3D blocks, which return
// intrinsics a canvas opened elsewhere gives meaning to. Here the renderer is a
// component, so it arrives through React context: `ComposedSceneVideo` provides
// the player it imports from `../LottieIcon.jsx`, and a render with no provider
// — the suite — draws the frame of the block without its pictogram.
import { createContext } from 'react'

export const IconPlayer = createContext(null)
