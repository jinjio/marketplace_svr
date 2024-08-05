import Debug from 'debug'
const debug = Debug('ankichampion:services:ai')
import assert from 'assert'
import { knex } from '../util/knexutil.js'

import OpenAI from 'openai'
import { is } from 'useragent'

let api_prices = []

// const checkAPIPrice = async () => {
//   api_prices = await knex('APIUsage')
// }

// checkAPIPrice().then()

if (process.env.ANKI_CHAMPION_OPEN_API_KEY == null) {
  console.error('process.env.ANKI_CHAMPION_OPEN_API_KEY not found')
  process.exit(1)
}

const openai = new OpenAI({
  apiKey: process.env.ANKI_CHAMPION_OPEN_API_KEY,
})

// 가격표 : https://openai.com/pricing
let ai = {
  // ask: async (question, model = 'gpt-3.5-turbo-0613') => {
  // ask: async (question, model = 'gpt-4') => {
  // ask: async (question, model = 'gpt-4-0613') => {
  // ask: async (question, model = 'gpt-4-32k-0613') => {
  // ask: async ({ question, model = 'gpt-4-0613', insert_prompt }) => {
  ask: async ({ question, model = 'gpt-4-1106-preview', insert_prompt, temperature = 0.5 }) => {
    debug('question', question, 'model', model)
    assert(question != null, 'question is null')
    insert_prompt = insert_prompt || [
      {
        role: 'system',
        content: "당신의 사람들의 질문에 대답해주는 인공지능입니다.",
      },
    ]
    try {
      let messages = [
        ...insert_prompt,
        {
          role: "user",
          content: question
        },
      ]
      let time_tag = 'gpt >> ' + new Date().toString()
      console.time(time_tag)

      const response = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        // max_tokens: 150,
        // top_p: 1,
        // frequency_penalty: 0,
        // presence_penalty: 0.6,
        // stop: ["\n", " Human:", " AI:"],
        // stop: [" Human:", " AI:"],
      })
      console.timeEnd(time_tag)
      debug('total tokens', response.usage.total_tokens)
      await knex('APIUsage').insert({
        type: 'openai',
        model,
        tokens: response.usage.total_tokens,

      })
      if (response.choices.length > 0) {
        debug('response', response.choices[0].message.content)
        return response.choices[0].message.content
      }
      return 'error'
    }
    catch (e) {
      debug(e.message)
      return e.message
    }
  },

  // chat: async (question, callback, model = 'gpt-4-0613') => {
  // stream 방식
  chat: async (question, callback, model = 'gpt-4-1106-preview') => {
    debug('ask', question)
    assert(question != null, 'question is null')

    try {
      let messages = [
        {
          role: 'system',
          content: "당신의 사람들의 질문에 대답해주는 인공지능입니다.",
        },
        {
          role: "user",
          content: question
        },
      ]
      let time_tag = 'gpt' + new Date().toString()
      console.time(time_tag)

      debug('calling', model)
      const stream = await openai.chat.completions.create({
        model,
        messages,
        stream: true,
        // temperature: 0.9,
        // max_tokens: 150,
        // top_p: 1,
        // frequency_penalty: 0,
        // presence_penalty: 0.6,
        // stop: ["\n", " Human:", " AI:"],
        // stop: [" Human:", " AI:"],
      },
        { responseType: 'stream' }
      )
      for await (const chunk of stream) {
        let is_finished = false
        if (chunk.choices[0].finish_reason == 'stop') {
          debug('stop')
          is_finished = true
        }
        let text = chunk.choices[0].delta.content
        callback(text, is_finished)
      }
      console.timeEnd(time_tag)
    }
    catch (e) {
      debug(e.message)
      return e.message
    }
  },
  generateSentence: async (word) => {
    const prompt = word
    const gptResponse = await OpenAI.Completion.create({
      engine: 'text-davinci-002',
      prompt: `${prompt} is a word in English. Use it in a sentence: `,
      max_tokens: 30
    })

    console.log(gptResponse.choices[0].text.trim())
    return gptResponse.choices[0].text.trim()
  },
  extractImage: async (files) => {
    let gptResponse
    let card_list = []
    for (let file of Object.values(files)) {
      const base64Image = file.data.toString('base64');
      const mimeType = file.mimetype; // 'image/jpeg' 등
  
      // base64 인코딩된 데이터 URL 생성
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      gptResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "extract only word"},
              {
                type: "image_url",
                image_url: {
                  // "url": `data:image/jpeg;base64,${file}`,
                  "url": dataUrl,
                },
              },
            ],
          },
        ],
          })
  
      console.log(gptResponse.usage, gptResponse.model)
      await knex('APIUsage').insert({
        provider: 'openai',
        model: gptResponse.model,
        prompt_tokens: gptResponse.usage.prompt_tokens,
        completion_tokens: gptResponse.usage.completion_tokens,
        total_tokens: gptResponse.usage.total_tokens,
      })
      console.log('추출된 단어', gptResponse.choices[0].message.content)
      let words = gptResponse.choices[0].message.content.split('\n')
      console.log(card_list)
    }
    return card_list
  }
}




async function getOpenAIPricing() {
  try {
    const response = await fetch('https://api.openai.com/v1/pricing', {
      headers: {
        'Authorization': `Bearer ${process.env.ANKI_CHAMPION_OPEN_API_KEY}`
      }
    })

    const data = await response.json()
    console.log(data)
  } catch (error) {
    console.error('API 호출 중 오류 발생:', error)
  }
}

async function test() {
  ai.chat('와인에 대해 알려줘', (text, is_finished) => {
    debug('text', text, is_finished)
  }).then(answer => {
    debug(answer)
    console.log(answer)
  })
}

// test().then(() => { })

export default ai

