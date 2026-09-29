/**
 * The provider <select>, sorted into what a person is choosing between.
 *
 * Five entries read fine as one list; sixteen do not. Alphabetical order would
 * scatter the two things people actually compare — a lab's own API against a
 * host serving other people's models — and put "Compatible OpenAI", the escape
 * hatch, in the middle of them. So the list keeps its declared order inside
 * each group and the groups come in a fixed order, with the hand-typed address
 * always last.
 *
 * Shared by the per-browser Settings and the admin's instance settings, which
 * is why it takes the smallest shape both have: an id and a group. An entry
 * with no group — a server older than this file, or a provider added without
 * one — lands in `custom` rather than disappearing from the select.
 */
export const PROVIDER_GROUP_ORDER = ['vendor', 'host', 'custom'] as const
export type ProviderGroupId = (typeof PROVIDER_GROUP_ORDER)[number]

export interface ProviderGroupBlock<T> {
  group: ProviderGroupId
  items: T[]
}

function groupOf(raw: unknown): ProviderGroupId {
  return (PROVIDER_GROUP_ORDER as readonly unknown[]).includes(raw) ? (raw as ProviderGroupId) : 'custom'
}

/** Split into non-empty groups, in PROVIDER_GROUP_ORDER, each in its declared order. */
export function groupProviders<T extends { group?: string }>(list: readonly T[]): ProviderGroupBlock<T>[] {
  return PROVIDER_GROUP_ORDER.map((group) => ({
    group,
    items: list.filter((p) => groupOf(p.group) === group),
  })).filter((block) => block.items.length > 0)
}

/** The i18n key naming a group (`settings.providerGroup.*`, both dictionaries). */
export function providerGroupKey(group: ProviderGroupId): string {
  return `settings.providerGroup.${group}`
}
