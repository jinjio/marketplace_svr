import Debug from 'debug'
const debug = Debug('ankichampion:services:web_push')
import assert from 'assert'
import { knex } from '../util/knexutil.js'
import webpush from 'web-push'

// const keys = webpush.generateVAPIDKeys()
// console.log('keys', keys)

console.log('public', process.env.DARI_CHAT_WEB_PUSH_PUBLIC_KEY)
const vapidKeys = {
  publicKey: process.env.DARI_CHAT_WEB_PUSH_PUBLIC_KEY,
  privateKey: process.env.DARI_CHAT_WEB_PUSH_PRIVATE_KEY
}

webpush.setVapidDetails(
  'mailto:support@ankichampion.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
)


let web_push_service = {
  send: async ({ user_id, payload }) => {
    try {
      debug('web_push_service.send', user_id, payload)
      let devices = await knex('WebPush').where('user_id', user_id)
      for (let device of devices) {
        let result = await webpush.sendNotification(device.subscription, Buffer.from(JSON.stringify(payload)))
        debug('web_push_service.send result', result)
      }

    } catch (e) {
      debug('web_push_service.send err', e)
    }
  }
}


async function test() {
  let result = await web_push_service.send({
    user_id: 'O6ktDQMPNNGb8iEFvxcCh',
    payload: {
      title: '알림 123',
      body: '금일 저녁 메뉴는 마라탕입니다.' + new Date().toLocaleString(),
      icon: 'https://www.ankichampion.com/logo.svg',
      tag: 'tag_test',
      link: '/#/chat_room/cyzC8v1QNBUnFi6m6HC1gk'
      // link: 'http://localhost:9099/#/chat_room/cyzC8v1QNBUnFi6m6HC1gk'
    }
  })
  console.log(result)
}

//  test().then(r => console.log(r)).catch(e => console.error(e))

export default web_push_service
