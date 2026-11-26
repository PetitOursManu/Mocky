import { describe, expect, it } from 'vitest'
import { blockDigest, blockName, docxXmlToText, splitBlocks } from './textBlocks'

const ARTICLE = `# Notre méthode

Quand un nouveau client nous contacte, on commence toujours par l'écouter pendant une heure, sans rien proposer du tout.

Ensuite on rédige une note de cadrage d'une page qu'il valide, puis on fabrique une maquette cliquable en une semaine.

## Les résultats

Cette année nous avons livré 42 projets, avec un taux de satisfaction de 94 % chez nos clients.

Les trois engagements que nous tenons :

- répondre en moins de 24 heures
- livrer à la date promise
- ne jamais facturer un dépassement

Merci.`

describe('cutting a text into blocks', () => {
  const blocks = splitBlocks(ARTICLE)

  it('cuts at paragraphs, with the heading as the title of what follows', () => {
    expect(blocks.map((b) => b.heading)).toEqual(['Notre méthode', 'Notre méthode', 'Les résultats', 'Les résultats'])
    expect(blocks[0].text.startsWith('Notre méthode\n\nQuand un nouveau client')).toBe(true)
  })

  it('keeps a list with the sentence that introduces it, and a last fragment with the block before', () => {
    const last = blocks[3].text
    expect(last).toContain('Les trois engagements que nous tenons :')
    expect(last).toContain('- ne jamais facturer un dépassement')
    expect(last.endsWith('Merci.')).toBe(true)
  })

  it('never makes a block of a heading alone', () => {
    expect(splitBlocks('# Titre seul\n\n## Autre titre')).toEqual([])
  })

  it('knows a block by its words, not by its place or its line breaks', () => {
    expect(blockDigest('Un  texte\nqui\tbouge')).toBe(blockDigest('un texte qui bouge'))
    const shifted = splitBlocks(`Un paragraphe ajouté en tête qui compte assez de mots pour être un bloc entier.\n\n${ARTICLE}`)
    expect(shifted.map((b) => b.digest)).toEqual(expect.arrayContaining(blocks.map((b) => b.digest)))
  })

  it('names a block by its heading, else by its first words', () => {
    expect(blockName(blocks[0])).toBe('Notre méthode')
    expect(blockName({ text: 'Une phrase assez longue pour être coupée avant la fin, proprement sur un mot', digest: 'x' }, 30)).toBe('Une phrase assez longue pour…')
  })
})

describe('reading a .docx', () => {
  it('turns headings into Markdown headings, list paragraphs into list lines, and decodes entities', () => {
    const xml =
      '<w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>La méthode</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t xml:space="preserve">On écoute, </w:t></w:r><w:r><w:t>puis on cadre &amp; on livre.</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>Premier point</w:t></w:r></w:p></w:body>'
    expect(docxXmlToText(xml)).toBe('# La méthode\n\nOn écoute, puis on cadre & on livre.\n\n- Premier point')
  })
})
