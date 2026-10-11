import { describe, it, expect } from 'vitest'
import {
  cleanFlowState,
  companionSection,
  flowStateScript,
  missingRoutes,
  normalizeScenarios,
  readFlow,
  resolveRoute,
  routeFor,
  slugRoute,
  SCENARIO_STATE_MAX_BYTES,
  flowScreenName,
} from './flows'
import { normalizeScreen } from './project'

const SHOP = `
function App() {
  const [cart, setCart] = useFlowState("cart", [])
  const [user] = useFlowState('user', null)
  const add = (p) => setCart((c) => [...c, { id: p.id, name: p.name, price: p.price, qty: 1 }])
  // MockyFlow.go("commented-out") is not a link
  const note = 'MockyFlow.go("in-a-string")'
  return (
    <div>
      <button onClick={() => MockyFlow.go("cart")}>Voir le panier ({cart.length})</button>
      <FlowLink to="login" className="x">Se connecter</FlowLink>
      <button onClick={() => MockyFlow.go(\`Checkout\`)}>Payer</button>
      <button onClick={() => MockyFlow.go(dynamic)}>?</button>
    </div>
  )
}`

describe('reading a screen', () => {
  it('finds the routes it opens, with the words clicked, and nothing in comments or strings', async () => {
    const r = await readFlow(SHOP)
    expect(r.links).toEqual([
      { route: 'cart', label: 'Voir le panier' },
      { route: 'login', label: 'Se connecter' },
      { route: 'checkout', label: 'Payer' },
    ])
  })

  it('finds the shared data, its initial value and how it is written', async () => {
    const r = await readFlow(SHOP)
    const cart = r.keys.find((k) => k.key === 'cart')
    expect(cart?.initial).toBe('[]')
    expect(cart?.writes[0]).toContain('setCart((c) => [...c, { id: p.id')
    expect(r.keys.find((k) => k.key === 'user')?.initial).toBe('null')
  })

  it('reads code that does not parse as saying nothing', async () => {
    expect(await readFlow('function App() { return <div onClick={() => MockyFlow.go("x")}')).toEqual({ links: [], keys: [] })
  })
})

const scr = (id: string, name: string, extra: Record<string, unknown> = {}) =>
  normalizeScreen({ id, name, code: 'function App(){}', ...extra }, 0)

describe('finding the screen a route opens', () => {
  const screens = [scr('a', 'Accueil', { route: 'home' }), scr('b', 'Panier'), scr('c', 'Confirmation de commande'), scr('d', 'Flyer', { page: 'a4' })]

  it('prefers a declared route, then the name, then the start of the name', () => {
    expect(resolveRoute(screens, 'home')).toBe('a')
    expect(resolveRoute(screens, 'Panier')).toBe('b')
    expect(resolveRoute(screens, 'confirmation')).toBe('c')
    expect(resolveRoute(screens, 'flyer')).toBeNull()
    expect(resolveRoute(screens, 'nowhere')).toBeNull()
  })

  it('lists the routes nobody answers', async () => {
    const missing = missingRoutes(screens, await readFlow(SHOP))
    expect(missing.map((m) => m.route)).toEqual(['cart', 'login', 'checkout'])
  })

  it('gives the first screen of a flow "home", and the next ones their name', () => {
    expect(routeFor(scr('x', 'Une page de connexion'), [])).toBe('home')
    expect(routeFor(scr('x', 'Une page de connexion'), [scr('a', 'A', { route: 'home' })])).toBe('une-page-de')
    expect(routeFor(scr('x', 'Y', { route: 'Mon Compte' }), [])).toBe('mon-compte')
  })
})

describe('a route', () => {
  it('is lowercase kebab-case without accents', () => {
    expect(slugRoute('  Mon Panier — Été ')).toBe('mon-panier-ete')
    expect(slugRoute('')).toBe('')
  })

  it('survives a reload on the screen, slugged', () => {
    expect(normalizeScreen({ id: 's', route: 'Panier' }, 0).route).toBe('panier')
    expect(normalizeScreen({ id: 's' }, 0).route).toBeUndefined()
  })
})

describe('what a companion screen is told', () => {
  it('names its route, its way back and the data it must read', async () => {
    const section = companionSection({
      route: 'cart',
      originName: 'Boutique',
      originRoute: 'home',
      label: 'Voir le panier',
      reading: await readFlow(SHOP),
      routes: ['home', 'cart'],
    })
    expect(section).toContain('route "cart"')
    expect(section).toContain('MockyFlow.go("home")')
    expect(section).toContain('"cart", initially []')
    expect(section).toContain('Routes that already exist in this prototype: "home"')
  })
})

describe('scenarios', () => {
  it('keep only what survives JSON, and refuse a state too large to be a scenario', () => {
    expect(cleanFlowState({ user: { name: 'Claire' }, fn: () => 1 })).toEqual({ user: { name: 'Claire' } })
    expect(cleanFlowState([])).toBeNull()
    expect(cleanFlowState({ big: 'x'.repeat(SCENARIO_STATE_MAX_BYTES) })).toBeNull()
  })

  it('drop malformed entries on load', () => {
    expect(
      normalizeScenarios([
        { id: 's1', name: '  Client  connecté ', startScreenId: 'a', state: { user: { name: 'C' } }, createdAt: 3 },
        { id: 's2', name: '', startScreenId: 'a', state: {} },
        { name: 'no id', startScreenId: 'a', state: {} },
        'nope',
      ]),
    ).toEqual([{ id: 's1', name: 'Client connecté', startScreenId: 'a', state: { user: { name: 'C' } }, createdAt: 3 }])
    expect(normalizeScenarios([])).toBeUndefined()
  })
})

describe('the state embedded in a srcDoc', () => {
  it('carries more than a scenario may keep', () => {
    const big = { cart: 'x'.repeat(SCENARIO_STATE_MAX_BYTES) }
    expect(JSON.parse(flowStateScript(big))).toEqual(big)
  })

  it('cannot close the script it is written in', () => {
    const out = flowStateScript({ cart: [{ name: '</script><script>alert(1)</script>' }] })
    expect(out).not.toContain('</script>')
    expect(JSON.parse(out)).toEqual({ cart: [{ name: '</script><script>alert(1)</script>' }] })
  })
})

describe('the name of a page made for a route', () => {
  const dict: Record<string, string> = { 'flows.route.cart': 'Panier' }
  const t = (k: string) => dict[k] ?? k
  it('is the person\'s word when there is one, the route capitalised otherwise', () => {
    expect(flowScreenName('cart', t)).toBe('Panier')
    expect(flowScreenName('order-history', t)).toBe('Order history')
  })
})
