/**
 * A refined iPhone-style device frame: metallic outer rail, thin black bezel,
 * rounded screen, an iOS status bar (time + signal/wifi/battery) and a Dynamic
 * Island. The status bar uses mix-blend-difference so it stays legible over any
 * background. Generated mobile screens are told (via the preset hint) to keep
 * the top ~54px clear, so nothing sits under the notch. Percentage sizing lets
 * it scale in the canvas and the demo player alike.
 */
/** Screen inner corner radius — also applied to the preview iframe so its
 * corners are actually clipped (border-radius on an ancestor does not clip an
 * iframe reliably; on the iframe element itself it does). */
export const SCREEN_RADIUS = '10% / 4.8%'

export default function DeviceChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div
        className="relative h-full w-full"
        style={{
          borderRadius: '13% / 6%',
          padding: '1.5%',
          background: 'linear-gradient(135deg, #54565c 0%, #232427 28%, #0b0b0d 72%, #2a2b2f 100%)',
          boxShadow:
            '0 1px 1px rgba(255,255,255,0.18) inset, 0 0 0 1px rgba(0,0,0,0.4), 0 26px 50px -18px rgba(0,0,0,0.6)',
        }}
      >
        <div className="relative h-full w-full bg-black" style={{ borderRadius: '11.5% / 5.4%', padding: '1.5%' }}>
          <div
            className="relative h-full w-full overflow-hidden bg-white"
            style={{ borderRadius: '10% / 4.8%', isolation: 'isolate' }}
          >
            {/* Clip wrapper: reliably rounds the iframe's corners */}
            <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: '10% / 4.8%' }}>
              {children}
            </div>

            {/* Status bar (blends over any background) */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between"
              style={{ height: '5.2%', paddingLeft: '8%', paddingRight: '8%', color: '#fff', mixBlendMode: 'difference' }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.02em' }}>9:41</span>
              <span className="flex items-center" style={{ gap: 5 }}>
                {/* signal */}
                <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
                  <rect x="0" y="7" width="3" height="4" rx="1" />
                  <rect x="4.5" y="5" width="3" height="6" rx="1" />
                  <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
                  <rect x="13.5" y="0" width="3" height="11" rx="1" />
                </svg>
                {/* wifi */}
                <svg width="16" height="11" viewBox="0 0 16 12" fill="currentColor">
                  <path d="M8 2.5c2.6 0 5 1 6.8 2.7l-1.4 1.5A7.6 7.6 0 0 0 8 4.6 7.6 7.6 0 0 0 2.6 6.7L1.2 5.2A9.6 9.6 0 0 1 8 2.5Zm0 3.6c1.6 0 3 .6 4.1 1.7l-1.5 1.5A3.7 3.7 0 0 0 8 8.2c-1 0-2 .4-2.6 1.1L3.9 7.8A5.7 5.7 0 0 1 8 6.1Zm0 3.5c.7 0 1.3.3 1.7.8L8 11.6 6.3 10a2.4 2.4 0 0 1 1.7-.8Z" />
                </svg>
                {/* battery */}
                <span className="flex items-center" style={{ gap: 1.5 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 22,
                      height: 11,
                      borderRadius: 3,
                      border: '1px solid currentColor',
                      padding: 1.5,
                    }}
                  >
                    <span style={{ display: 'block', width: '100%', height: '100%', background: 'currentColor', borderRadius: 1 }} />
                  </span>
                  <span style={{ display: 'inline-block', width: 1.5, height: 4, background: 'currentColor', borderRadius: 1 }} />
                </span>
              </span>
            </div>

            {/* Dynamic Island */}
            <div
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-black"
              style={{ top: '1.4%', height: '3.4%', width: '30%' }}
            />

            {/* Home indicator */}
            <div
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full"
              style={{ bottom: '1%', height: '0.55%', width: '34%', background: '#fff', mixBlendMode: 'difference' }}
            />
          </div>
        </div>
      </div>

      {/* Side buttons (decorative) */}
      <div className="pointer-events-none absolute left-0 top-[16%] h-[5%] w-[1.2%] rounded-l bg-neutral-800" />
      <div className="pointer-events-none absolute left-0 top-[26%] h-[9%] w-[1.2%] rounded-l bg-neutral-800" />
      <div className="pointer-events-none absolute left-0 top-[38%] h-[9%] w-[1.2%] rounded-l bg-neutral-800" />
      <div className="pointer-events-none absolute right-0 top-[30%] h-[12%] w-[1.2%] rounded-r bg-neutral-800" />
    </div>
  )
}
