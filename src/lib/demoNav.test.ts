import { describe, it, expect } from 'vitest'
import { demoOrder, stepScreen } from './demoNav'
import type { Screen } from './project'

function screen(id: string, code = 'function App(){return null}'): Screen {
  return { id, name: id, prompt: '', code, componentName: 'App', createdAt: 0, x: 0, y: 0, w: 1440, h: 900, device: 'none', links: [] }
}

describe('demoOrder', () => {
  it('follows the array and skips screens that never generated', () => {
    expect(demoOrder([screen('a'), screen('empty', ''), screen('b')])).toEqual(['a', 'b'])
  })
})

describe('stepScreen', () => {
  const order = ['a', 'b', 'c']

  it('steps forward and back', () => {
    expect(stepScreen(order, 'a', 1)).toBe('b')
    expect(stepScreen(order, 'b', -1)).toBe('a')
  })

  it('wraps at both ends', () => {
    expect(stepScreen(order, 'c', 1)).toBe('a')
    expect(stepScreen(order, 'a', -1)).toBe('c')
  })

  it('starts from an end when the current screen is not in the order', () => {
    expect(stepScreen(order, 'gone', 1)).toBe('a')
    expect(stepScreen(order, 'gone', -1)).toBe('c')
  })

  it('has nowhere to go with one screen or none', () => {
    expect(stepScreen(['a'], 'a', 1)).toBeNull()
    expect(stepScreen([], 'a', 1)).toBeNull()
  })
})
