import Debug from 'debug'
const debug = Debug('ankichampion:services:ai:test')

import { expect, test } from 'vitest'
import ai from './ai'

test('ai', async () => {
  let answer = await ai.chat('와인에 대해 알려줘', (text, finished) => {
    debug('text', text)
    expect(text).toBeTypeOf('string')
  })
})