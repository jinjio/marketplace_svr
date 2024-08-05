import Debug from 'debug'
const debug = Debug('ankichampion:service:sentence')

import fs from "fs"
import path from "path"
import OpenAI from "openai"
import tranlationService from './translation.js'

const openai = new OpenAI({
  apiKey: process.env.ANKI_CHAMPION_OPEN_API_KEY,
})

const sentence = {
  generate: async (word) => {
    try {
      const prompt = `Use the word "${word}" in a short sentence of less than 10 words in the first line, Then translate the sentence to Korean in the second line.`

      const gptResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 60,
        temperature: 0.5
      })

      const responseText = gptResponse.choices[0].message.content.trim()

      // Split the response by new lines and filter out empty lines
      const lines = responseText.split('\n').map(line => line.trim()).filter(line => line)

      // Ensure we have at least two lines
      const generatedSentence = lines[0] || 'No sentence generated'
      const translatedSentence = lines[1] || 'No translation generated'

      const result = {
        sentence: generatedSentence,
        translated: translatedSentence
      }
      console.log(result)
      return result
    }
    catch (e) {
      console.error('sentence', e.message)
    }
  },
}


export default sentence