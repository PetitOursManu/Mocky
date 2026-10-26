/**
 * What a connection may reach — the two levels of an assistant key (X9).
 *
 *   read    the tools in READ_TOOLS, and nothing else: the others are neither
 *           listed nor callable, and no prompt is offered (every prompt leads
 *           to a tool that writes)
 *   write   every tool the account may use, as an OAuth connection has
 *
 * READ_TOOLS is CLOSED on purpose. A tool added tomorrow is a WRITER until
 * somebody adds its name here, after checking that it changes nothing in the
 * account — so a read key cannot pick up a new way to write by accident. The
 * test holds this list to the tools annotated `readOnlyHint: true`, so the two
 * cannot drift apart without somebody deciding it.
 *
 * The gate is applied to each request's McpServer BEFORE any tool is
 * registered, and it sits on the SDK's one funnel (`_createRegisteredTool`,
 * which `registerTool`, `tool` and `experimental.tasks.registerToolTask` all
 * call), so there is no second door to forget. A tool refused here is simply
 * not on the server: `tools/list` does not show it and `tools/call` answers
 * "Tool … not found", exactly like a tool that does not exist.
 *
 * A level that is missing or unknown is `read`: this fails closed, like
 * `scopeAllows`. An OAuth connection is passed `write` explicitly by routes.js.
 */

export const KEY_LEVELS = Object.freeze(['read', 'write'])

/**
 * The tools a read key reaches. Closed: a name absent from here is a tool that
 * writes. A frozen ARRAY, and the lookup a private Set behind `isReadTool`:
 * `Object.freeze(new Set(…))` freezes the object and not its contents, so
 * `READ_TOOLS.add('create_design')` from anywhere in the process used to hand
 * every read key a tool that writes.
 */
export const READ_TOOLS = Object.freeze([
  'mocky_guide',
  'list_projects',
  'get_project',
  'get_design',
  'get_screenshot',
  'audit_design',
  'search_free_images',
])
const readTools = new Set(READ_TOOLS)

/** Whether a tool is on the closed read list. */
export const isReadTool = (name) => readTools.has(name)

/** The level a value names — anything but exactly 'write' is 'read'. */
export const levelOf = (v) => (v === 'write' ? 'write' : 'read')

export const toolAllowed = (level, name) => levelOf(level) === 'write' || isReadTool(name)

/** What a refused registration hands back: the shape callers may touch, attached to nothing. */
function detachedTool() {
  const noop = () => {}
  return { enabled: false, enable: noop, disable: noop, remove: noop, update: noop }
}

/**
 * Put the gate on a NEW McpServer. Call it right after `new McpServer(…)`, before
 * the first tool is registered. Throws when the SDK no longer has the funnel this
 * relies on: a read-only server that cannot be made read-only must not be built.
 */
export function gateTools(server, level) {
  if (levelOf(level) === 'write') return server
  const create = server?._createRegisteredTool
  if (typeof create !== 'function') throw new Error('gateTools: this SDK has no tool funnel to gate; refusing to build a read-only server.')
  server._createRegisteredTool = function gatedCreate(name, ...rest) {
    return isReadTool(name) ? create.call(this, name, ...rest) : detachedTool()
  }
  return server
}
