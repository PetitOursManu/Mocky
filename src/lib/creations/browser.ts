import { previewDocument } from '../../components/Preview'
import type { Creation, StageDeps } from './stage'

/** The account's creations (server/creations.js). Plain fetch: every caller treats a failure as "none". */
export async function listCreations(): Promise<Creation[]> {
  const res = await fetch('/api/creations', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(String(res.status))
  const data = await res.json()
  return Array.isArray(data?.creations) ? data.creations : []
}

export async function saveCreation(c: Omit<Creation, 'id' | 'createdAt'>): Promise<Creation | null> {
  const res = await fetch('/api/creations', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(c),
  })
  if (!res.ok) return null
  return (await res.json())?.creation ?? null
}

export async function deleteCreation(id: string): Promise<boolean> {
  const res = await fetch(`/api/creations/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' })
  return res.ok
}

const RENDER_TIMEOUT_MS = 12_000

/**
 * Mounts the code in the real preview document, in the real sandbox, off screen.
 * Null means it mounted; anything else, including silence, is a failure.
 */
export const renderInSandbox: StageDeps['render'] = (code) =>
  new Promise((resolve) => {
    const frameId = `creation-${Math.random().toString(36).slice(2)}`
    const iframe = document.createElement('iframe')
    iframe.setAttribute('sandbox', 'allow-scripts')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0'
    let timer = 0
    const finish = (result: string | null) => {
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      iframe.remove()
      resolve(result)
    }
    const onMessage = (e: MessageEvent) => {
      const d = e.data
      if (e.source !== iframe.contentWindow || !d?.__mocky || d.frameId !== frameId) return
      if (d.type === 'ok') finish(null)
      else if (d.type === 'error') finish(String(d.message || 'render error').slice(0, 300))
    }
    window.addEventListener('message', onMessage)
    timer = window.setTimeout(() => finish('timeout'), RENDER_TIMEOUT_MS)
    iframe.srcdoc = previewDocument(code, ['icons'], { frameId })
    document.body.appendChild(iframe)
  })
