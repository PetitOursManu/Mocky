import { describe, expect, it } from 'vitest'
import { figureInText, inventedValues, numbersIn } from './numbers'

const has = (text: string, v: number) => figureInText(v, numbersIn(text))

describe('the figures of a text', () => {
  it('reads plain, spaced and separated numbers in French and English', () => {
    expect(has('12 bénévoles', 12)).toBe(true)
    expect(has('1 200 inscrits', 1200)).toBe(true)
    expect(has('1 200 inscrits', 1200)).toBe(true)
    expect(has('1,200 sign-ups', 1200)).toBe(true)
    expect(has('un taux de 3,5 %', 3.5)).toBe(true)
    expect(has('a rate of 3.5%', 3.5)).toBe(true)
    expect(has('une baisse de -4 points', -4)).toBe(true)
  })

  it('takes a share and its fraction, a figure and its multiplier, as the same', () => {
    expect(has('92 % de réussite', 0.92)).toBe(true)
    expect(has('0,92 de réussite', 92)).toBe(true)
    expect(has('un budget de 1,2 M€', 1_200_000)).toBe(true)
    expect(has('un budget de 1,2 M€', 1.2)).toBe(true)
    expect(has('12 k abonnés', 12_000)).toBe(true)
    expect(has('3 milliards', 3e9)).toBe(true)
  })

  it('does not find what the text never wrote', () => {
    expect(has('12 bénévoles et 40 élèves', 52)).toBe(false)
    expect(has('douze bénévoles', 12)).toBe(false)
    expect(has('92 % de réussite', 93)).toBe(false)
  })

  it('names the items whose value is not in the text', () => {
    const doc = { items: [{ label: 'A', value: 12 }, { label: 'B' }, { label: 'C', value: 7 }] }
    expect(inventedValues(doc, 'A vaut 12.')).toEqual([2])
    expect(inventedValues(null, 'x')).toEqual([])
  })
})
