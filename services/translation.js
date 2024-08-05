import Debug from 'debug'
const debug = Debug('ankichampion:services:translation')

// https://cloud.google.com/translate/docs/setup?hl=ko
import { TranslationServiceClient } from '@google-cloud/translate'
const projectId = 'translate-402609'
const location = 'global'
const translationClient = new TranslationServiceClient()
import aiService from './ai.js'
import OpenAI from "openai"

import { knex } from '../util/knexutil.js'
import ai from './ai.js'

const openai = new OpenAI({
  apiKey: process.env.ANKI_CHAMPION_OPEN_API_KEY,
})


const lang_list = [
  'ko', 'en', 'zh-cn', 'zh-tw', 'ja', 'vi',
  'es', 'fr', 'de', 'it', 'bg',
  'cs', 'da', 'el', 'et', 'fi',
  'hu', 'id', 'lt', 'lv', 'nb',
  'nl', 'pl', 'pt', 'ro', 'pl',
  'sk', 'sl', 'sv', 'tr', 'uk'
]

// const lang_need_google = [
//   'vi',
// ]

const DEEPL_API_KEY = process.env.DEEPL_API_KEY

const tranlationService = {

  translate: async (text, target_language, src_language, translator) => {
    const use_ai = true
    if (target_language === src_language)
      return text

    let time_tag = 'translate >> ' + new Date().toString()
    console.time(time_tag)

    if (translator?.indexOf('gpt') >= 0) {
      return await tranlationService.translateAI(text, target_language, src_language, translator)
    }

    let translated = ''
    if (target_language == 'vi') {
      // 베트남어는 deepl 에서 안되므로 DeepL 중국어 -> 구글 번역 베트남어
      if (use_ai) {
        translated = await tranlationService.translateAI(text, target_language, src_language)
      } else {
        const text_en = await tranlationService.translateDeepl(text, 'en', src_language)
        translated = await tranlationService.translateGoogle(text_en, 'vi', 'en')
      }
    } else if (src_language == 'vi') {
      // 베트남어 -> 영어 -> 타켓
      if (use_ai) {
        translated = tranlationService.translateAI(text, target_language, src_language)
      } else {
        const text_en = await tranlationService.translateGoogle(text, 'en', 'vi')
        translated = await tranlationService.translateDeepl(text_en, target_language, 'en')
      }
      // const text_zh_cn = await tranlationService.translateGoogle(text, 'zh-cn', 'vi')
      // const translated = await tranlationService.translateDeepl(text_zh_cn, target_language, 'zh-cn')
      // return translated
    } else {
      translated = await tranlationService.translateDeepl(text, target_language, src_language)
    }
    console.timeEnd(time_tag)
    return translated
  },

  transcript: async (text, target_language, src_language) => {
    const translated = await aiService.ask({
      question: `'''${text}'''를 '${target_language}'로 음차해서 음역하세요. 설명은 뺍니다.`,
      insert_prompt: [
        {
          role: 'system',
          content: `당신의 사람들의 말을 '${target_language}'로 음역해주는 인공지능이다.`,
        },
      ],
      temperature: 0,
    })
    return translated
  },

  translateAI: async (text, target_language, src_language, model) => {
    const translated = await aiService.ask({
      question: text,
      model,
      insert_prompt: [
        {
          role: 'system',
          content: `당신의 사람들의 말을 '${target_language}'로 번역해주는 인공지능이다.`,
        },
      ]
    })
    return translated
  },

  translateGoogle: async (text, target_language, src_language) => {
    // Construct request
    const request = {
      parent: `projects/${projectId}/locations/${location}`,
      contents: [text],
      mimeType: 'text/plain', // mime types: text/plain, text/html
      sourceLanguageCode: src_language,
      targetLanguageCode: target_language,
    }

    // Run request
    const [response] = await translationClient.translateText(request)

    for (const translation of response.translations) {
      return translation.translatedText
    }
    return 'error'
  },

  getTranslateLanguageList: async () => {
    return lang_list
  },

  // 지원하는 언어를 찾아보고 없으면 영어를 기본으로 해서 돌려준다.
  getTranslateLanguageFor: (lang) => {
    if (lang.toLowerCase() == 'vi-vn')
      lang = 'vi'
    else if (lang.toLowerCase() == 'ko-kr')
      lang = 'ko'

    let found = lang_list.find((item) => { return item == lang })
    if (found)
      return found
    else
      return 'en'
  },
  translateDeepl: async (text, target_language, src_language, free = true) => {
    try {
      if (target_language == 'zh-cn') target_language = 'zh'
      let url = free == true ? 'https://api-free.deepl.com/v2/translate' : ''
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
          'X-RapidAPI-Host': 'deepl-translator.p.rapidapi.com'
        },
        body: JSON.stringify({
          text: [text],
          target_lang: target_language.toUpperCase(),
          // source: src_language.toUpperCase(),ㅐ
        })
      })

      // Response Example
      //   {
      //     "translations": [
      //         {
      //             "detected_source_language": "KO",
      //             "text": "hi"
      //         }
      //     ]
      // }
      const data = await response.json()
      // debug('>> translate', src_language, '=>', target_language, text, data.text)
      if (data.translations.length > 1) {
        console.log('bingo')
      }
      if (data.translations != null && data.translations.length > 0)
        return data.translations[0].text
      return data.message
    } catch (e) {
      console.error('translate', e.message)
    } finally {
    }
  },

  translate_rapid_api: async (text, target_language, src_language = 'AUTO') => {
    try {
      const response = await fetch('https://deepl-translator.p.rapidapi.com/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': 'er8baJLrGYmshLwcNt9WwDLYFOTop1CVSaIjsnpFiHFdRWERJQ',
          'X-RapidAPI-Host': 'deepl-translator.p.rapidapi.com'
        },
        body: JSON.stringify({
          text: text,
          source: src_language.toUpperCase(),
          target: target_language
        })
      })

      const data = await response.json()
      debug('>> translate', src_language, '=>', target_language, text, data.text)
      return data.text
    } catch (e) {
      console.error('translate', e.message)
    } finally {
    }
  },

  translateOpenai: async (word) => {
    try {
      let separator = '뉴라인 문자'
      const prompt = `${word}를 가지고 한국어 뜻을 알려줘. 뜻이 여러개 있는 단어라면 ${separator}를 구분자로 해서 알려주는데 중복되는 뜻은 빼고 알려줘. 자주는 쓰는 의미의 뜻을 최대 3개까지만 하고 그 이상은 알려주지마.  뜻 말고 다른 문구는 붙이지말어.`

      console.log('word:', word)
      const gptResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 60,
        temperature: 0.1  // 낮은 값(예: 0.1): 모델이 더 예측 가능하고 일관된 응답, 높은 값(예: 0.9): 모델이 더 창의적이고 다양한 응답
      })

      let result = gptResponse.choices[0].message.content.trim()

      // \n 앞의 공백 제거.

      // result = responseText.split('\n').map(line => line.replace('-', '').trim()).filter(line => line)
      // result.splice(result.length, 0)
      console.log(result)
      return result
    }
    catch (e) {
      console.error('sentence', e.message)
    }
  }

}

export default tranlationService

// tranlationService.translateOpenai('both').then((r) => {
//   console.log('result', r)
// })

// async function test() {
//   // Construct request
//   let text = "안녕하세요"

//   debug('translated', await tranlationService.translate('안녕하세요', 'en'))
//   debug('translated', await tranlationService.translate('안녕하세요', 'vi'))
//   debug('translated', await tranlationService.translate('Cuộc họp về sản phẩm mới sẽ diễn ra vào lúc 3 giờ chiều thứ Ba', 'ko', 'vi'))
// }

// test().then(() => { })