import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { TEST_CARD } from './composition.js'

/**
 * Phase 1's entire output: a flat colour and a counter.
 *
 * The counter is not decoration. A solid-colour clip looks exactly the same
 * whether ninety frames were rendered or one frame was repeated by the encoder,
 * so the one artefact whose whole job is to prove the chain works would be
 * unable to distinguish a working chain from a broken one. The number on screen
 * is the proof. The wording is the other half: whoever ends up watching this
 * must be told, in the picture itself, that it is not the video they asked for —
 * an HTTP header saying so is invisible by the time the file is in a library.
 *
 * Written by hand, like every composition here will be. The model never writes
 * Remotion code; it writes a timeline object, and phase 2 adds the composition
 * that consumes one.
 */
export const TestCard = () => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  return (
    <AbsoluteFill
      style={{
        backgroundColor: TEST_CARD.backgroundColor,
        color: TEST_CARD.foregroundColor,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 60, fontWeight: 700, letterSpacing: -1 }}>Mocky render worker</div>
      <div style={{ fontSize: 34, marginTop: 20, opacity: 0.8 }}>test card — this is not your timeline</div>
      <div style={{ fontSize: 128, marginTop: 44, fontVariantNumeric: 'tabular-nums' }}>{(frame / fps).toFixed(2)}s</div>
      <div style={{ fontSize: 26, marginTop: 12, opacity: 0.55 }}>
        frame {frame + 1} / {durationInFrames}
      </div>
    </AbsoluteFill>
  )
}
