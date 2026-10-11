/**
 * Working prototypes: state that survives going from one screen to another,
 * and navigation by the NAME of a page.
 *
 * WHY A STORE IN THE PARENT
 *
 * Every screen is its own sandboxed document (I2), and the demo replaces one
 * document with the next when a link is followed — so a cart filled on the
 * product page was empty again on the cart page, and "signed in" lasted until
 * the next click. A sandbox without `allow-same-origin` has no localStorage
 * either. The only thing that outlives a document is the page that holds it:
 * the store lives in the demo (`DemoPlayer`), the frame keeps a copy, and every
 * write is posted up. A new screen is born with the store in its srcDoc
 * (`window.__mockyFlowInit`) and kept current by `{__mockyCmd:'flow'}`.
 *
 * WHY A ROUTE AND NOT A SCREEN ID
 *
 * The model writes the code before the screen it links to exists — that is the
 * point of the companion screens (`lib/flows.ts`). It names the page ("cart"),
 * and the demo finds the screen that answers to that name. A route nobody
 * answers to is what Mocky reads as "create this screen".
 *
 * Outside the demo — on the canvas — the store is the frame's own and `go` asks
 * nobody: a screen still works by itself, it just goes nowhere.
 */
export const FlowSource = `var __mockyFlowStore = (function () {
  var state = {};
  try {
    var init = window.__mockyFlowInit;
    if (init && typeof init === 'object' && !Array.isArray(init)) state = init;
  } catch (_) {}
  var subs = [];
  function emit() { for (var i = 0; i < subs.length; i++) { try { subs[i](); } catch (_) {} } }
  window.addEventListener('message', function (e) {
    // Only the page that holds this frame speaks for the store.
    if (e.source !== window.parent) return;
    var d = e.data || {};
    if (d.__mockyCmd === 'flow' && d.state && typeof d.state === 'object' && !Array.isArray(d.state)) {
      state = d.state;
      emit();
    }
  });
  return {
    get: function (k) { return state[k]; },
    set: function (k, v) {
      var next = {};
      for (var key in state) next[key] = state[key];
      // JSON only: what crosses postMessage and is kept in a scenario must
      // come back the same. A function or a Date would not.
      try { next[k] = v === undefined ? undefined : JSON.parse(JSON.stringify(v)); } catch (_) { return; }
      if (next[k] === undefined) delete next[k];
      state = next;
      emit();
      if (window.__mockyPost) window.__mockyPost('flow-set', { key: String(k), value: next[k] === undefined ? null : next[k] });
    },
    subscribe: function (fn) {
      subs.push(fn);
      return function () { subs = subs.filter(function (x) { return x !== fn; }); };
    }
  };
})();

function useFlowState(key, initial) {
  var force = React.useReducer(function (n) { return n + 1; }, 0)[1];
  React.useEffect(function () { return __mockyFlowStore.subscribe(force); }, []);
  var stored = __mockyFlowStore.get(key);
  var value = stored === undefined ? initial : stored;
  var set = React.useCallback(function (next) {
    var cur = __mockyFlowStore.get(key);
    var base = cur === undefined ? initial : cur;
    __mockyFlowStore.set(key, typeof next === 'function' ? next(base) : next);
  }, [key]);
  return [value, set];
}

var MockyFlow = {
  go: function (route) {
    var r = String(route == null ? '' : route).trim();
    if (!r) return;
    if (window.__mockyPost) window.__mockyPost('flow-go', { route: r });
    // An exported project has no Mocky above it: its own App listens for this.
    try { window.dispatchEvent(new CustomEvent('mocky:flow-go', { detail: { route: r } })); } catch (_) {}
  },
  reset: function () {
    if (window.__mockyPost) window.__mockyPost('flow-reset', {});
  }
};

function FlowLink(props) {
  var to = props.to, children = props.children, onClick = props.onClick;
  var rest = {};
  for (var k in props) { if (k !== 'to' && k !== 'children' && k !== 'onClick') rest[k] = props[k]; }
  rest.href = '#';
  rest.onClick = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (onClick) onClick(e);
    MockyFlow.go(to);
  };
  return React.createElement('a', rest, children);
}`

export const FLOW_EXPORTS = ['useFlowState', 'MockyFlow', 'FlowLink'] as const

/**
 * The rules a model is given with the kit. Printed once, after the component
 * list, wherever the pack is in scope — so an EDIT of a working prototype keeps
 * its forms submitting and its cart counting.
 */
export const FLOW_RULES = `PROTOTYPE FLOWS — this screen is part of a clickable prototype, and it must WORK, not only look right:
- Shared data goes through useFlowState(key, initial), never useState, whenever ANOTHER screen should see it. Standard keys, reuse them: "user" (the signed-in user, { name, email } or null), "cart" (array of { id, name, price, qty, image? }), "favorites" (array of ids), "filters" (object), "order" (the last order placed), "form:<name>" (the data a form submitted). Values are plain JSON.
- A sign-in form validates its fields and shows errors inline; it accepts any well-formed email with a password of 4 characters or more, shows that hint under the form in the page's own language (e.g. "Demo: any email, a password of 4+ characters"), then sets "user" and opens the next page with MockyFlow.go(...).
- A form that sends something (contact, sign-up, booking, checkout) validates, stores what was entered under "form:<name>" or "order", then opens its confirmation page with MockyFlow.go("confirmation") — or a more precise route.
- Filters, search, sorting and tabs really change what is listed (filter the array you render). They stay on the page: no navigation.
- "Add to cart" updates "cart" (increment qty when the item is already in it) and every cart badge reads its count from "cart". Opening the cart is MockyFlow.go("cart").
- A screen that SHOWS shared data reads it with useFlowState and handles the empty case: an empty cart says so and links back; a signed-out visitor sees a link to MockyFlow.go("login").
- Routes are short lowercase English words or kebab-case: "home", "login", "signup", "account", "dashboard", "catalog", "product", "cart", "checkout", "confirmation", "contact". Use a route only for a page a visitor would really go to next; Mocky creates the screens the routes name.
- Never use localStorage, sessionStorage, cookies, fetch or window.location: none exists in the sandbox.`
