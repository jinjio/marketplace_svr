import Debug from 'debug'
const debug = Debug('ankichampion:ws_server')
import assert from 'assert'
import jkutil from '../util/jkutil.js'

import { WebSocketServer, WebSocket } from 'ws'
import jwt from 'jsonwebtoken'
import config from '../util/config.js'
import { knex } from '../util/knexutil.js'
import WsMessage from './ws_message.js'
import WsRoom from './ws_room.js'
import chatRoomService from '../services/chat_room.js'
import AiService from '../services/ai.js'
import tranlationService from '../services/translation.js'
import awsutil from '../util/awsutil.js'
import webPushService from '../services/web_push.js'

class ws_server {
  constructor(httpServer) {
    // console.log('ws_server created')
    this.rooms = []
    const ws_server = new WebSocketServer({
      server: httpServer,
      //noServer: true,
      perMessageDeflate: true,
      verifyClient: async (info, cb) => {
        debug('verifyClient', info.origin)
        let token = new URLSearchParams(info.req.url.split('?')[1]).get('token')
        if (token == null && token.length == 0) {
          cb(false)
        }
        // debug('token', token, 'cb', cb)
        try {
          let tokenUser = jwt.verify(token, config.jwt_secret)
          info.req.user = tokenUser

          const pathParts = info.req.url.split('?')[0].split('/')
          const room_type = pathParts[1]  // "chat_room"
          const room_id = pathParts[2]
          if (room_id == null) debugger
          info.req.room_type = room_type
          info.req.room_id = room_id

          let room = await this.getRoom(room_type, room_id)
          assert(room != null, 'no_room')

          let member = await chatRoomService.findMember(room_id, info.req.user.id)
          info.req.enter_count = member?.enter_count || 0
          if (member == null && this.is_public === false) {
            // throw new Error('not_joined')
            cb(false)
          } else {
            await chatRoomService.updateMemberEnterCount(room_id, info.req.user.id)
            cb(true) // ws_server.on('connection', async (ws, req) => { 이 호출되도록 함.  
          }
        } catch (e) {
          debug('verifyClient error', e.message)
          cb(false, 403, 'Forbidden')
        }
        return
      }
    })
    this.ws_server = ws_server
    ws_server.on('connection', async (ws, req) => {
      ws.is_alive = true
      ws_server.on('error', (e) => {
        console.error('ws_server error', e)
      })
      // 크롬 브라주에서 pong이 구현이 아직 안되어 있는듯.
      // ws_server.on('pong', (e) => {
      // 	console.log('pong', e)
      // 	ws.is_alive = true
      // })
      let userInDB = await knex('User').where('id', req.user.id).first()
      assert(userInDB != null, 'no_user_in_db')
      ws.user = {
        id: req.user.id,
        language: req.headers['accept-language'],
        avatar: userInDB.avatar,
        nickname: userInDB.nickname,
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        enter_count: req.enter_count,
      }

      ws.language = req.headers['accept-language']?.split(',')[0].toLowerCase()
      // 지원안하는 언어의 경우 영어로 취급
      ws.language = tranlationService.getTranslateLanguageFor(ws.language)

      let room = await this.getRoom(req.room_type, req.room_id)
      room.joinClient(ws)

      // accept-language:'ko,en;q=0.9'
      ws.on('message', (data, isBinary) => {
        let message = JSON.parse(data.toString())
        console.log('received: %s', data.toString())
        if (message.command == 'pong') {
          ws.is_alive = true
        }
        ws.onMessage(message.command, message.options)
        // WsMessage.onMessageJSON(user, message, this)
      })
      ws.on('close', (reasonCode, description) => {
        debug(`session close ${reasonCode} ${description}`)
        this.onClose(ws).then()
      })
      // ws.send('something')
      ws.sendCommand('hello', {
        name: 'ankichampion',
      })
    })
  }
  async onClose(client) {
    debug('onClose', client.nickname)
    let room = client.room
    if (room != null) await room.leaveClient(client)
    // if (user.playground != null) await user.playground.leaveUser(user)
    // if (user.chat_room != null) await user.chat_room.leaveUser(user)
    // if (user.gameroom != null) await user.gameroom.leaveUser(user)
    // jkutil.arrRemove(this.allUsers, user)
    debug('allUsers', this.ws_server.clients.size)
    if (room.clients.length == 0) {
      debug('all users left')
      jkutil.arrRemove(this.rooms, room)
    }
    console.log('rooms', this.rooms)
  }

  async getRoom(room_type, room_id) {
    assert(room_type != null, 'no_room_type')
    assert(room_id != null, 'no_room_id')
    let room = this.rooms.find(room => room.room_type == room_type && room.room_id == room_id)
    if (room == null) {
      room = new WsRoom({ room_type, room_id })
      room.created = true
      await room.init()
      this.rooms.push(room)
    } else {
      room.created = false
    }
    return room
  }

  getJoinedChatRooms(user_id) {
    assert(user_id != null, 'no user_id')
    let rooms = this.rooms.filter(room => room.members.includes(user_id))
    return rooms
  }
}

let instance
export default {
  // Singleton
  getInstance: function (httpServer = null) {
    if (instance == null) {
      instance = new ws_server(httpServer)
      debug("ws_server instance created")
    }
    return instance
  }
}

WebSocket.prototype.sendCommand = function (command, options) {
  try {
    let data = {
      command,
      options,
    }
    this.send(JSON.stringify(data))
  } catch (e) {
    console.error('sendCommand Error : ', e)
  }
}

WebSocket.prototype.onMessage = async function (command, options) {
  try {
    let room = this.room
    if (command == 'chat') {
      let chat_id = jkutil.getUniqueId()
      if (options.text?.length > 0) {
        // 스피너가 자기 언어는 빼야 한다. 피크닉 간 돼지 마리수 세는 것처럼

        for (let client of room.clients) {
          let response_options = {
            text: [options.text],
            user_id: this.user.id || 'guest',
            sender: this.user.nickname,
            avatar: this.user.avatar,
            chat_id: chat_id,
            sender_language: room.use_translation ? this.language : null,
            stamp: Date.now()
          }
          if (room.use_translation && client.language !== this.language) response_options.text.push('⌛')
          client.sendCommand('chat', response_options)
        }
        let save_data = {
          user_id: this.user.id,
          chat_room_id: room.room_id,
          language: this.language,
          translator: 'deepl',
          // translator: 'gpt-4-1106-preview',
        }
        save_data.text = JSON.stringify([options.text])
        let translated_dic = {}
        if (room.use_translation) {
          // let arr_translated = await Promise.all(room.translation_languages.map(async (translate_language) => {
          //   return { [translate_language]: await tranlationService.translate(options.text, translate_language, this.language) }
          // }))
          await Promise.all(room.translation_languages.map(async (translate_language) => {
            translated_dic[translate_language] = await tranlationService.translate(options.text, translate_language, this.language, save_data.translator)
            // translated_dic[`transcript_${translate_language}`] = await tranlationService.transcript(options.text, translate_language, this.language, save_data.translator)
          }))
          // translated_dic = {}
          // for (let item of arr_translated) {
          //   for (let key in item) {
          //     translated_dic[key] = item[key]
          //   }
          // }
          console.log('num of clients', room.clients.length)
          for (let client of room.clients) {
            console.log('client', client.user.nickname, client.language)
            if (client.language == this.language) continue
            let translated = translated_dic[client.language]
            let transcript = translated_dic[`transcript_${client.language}`]
            console.log('  translated', translated, 'to', client.user.nickname)
            client.sendCommand('chat', {
              sender: this.user.nickname,
              user_id: this.user.id,
              text: [translated || 'error'],
              // text: [translated || 'error', transcript],
              chat_id: chat_id,
              option: 'append',
              language: client.language,
              stamp: Date.now()
            })
          }
        }

        for (let offline_members of room.offline_members) {
          if (translated_dic[offline_members.lang] == null) {
            console.log('bingo')
          }
          await webPushService.send({
            user_id: offline_members.user_id,
            payload: {
              title: options.text,
              body: translated_dic[tranlationService.getTranslateLanguageFor(offline_members.lang)] || offline_members.lang,
              icon: 'https://www.ankichampion.com/logo.svg',
              tag: 'tag_test',
              link: `/#/chat_room/${room.room_id}}`
            }
          })

        }
        if (translated_dic != null)
          save_data.translated = translated_dic
        await knex('ChatMessage').insert(save_data)

        debug('ai', room.use_ai)
        // 이미지 데이터도 AI로 대답하는 것은 나중에 하자.
        if (room.use_ai === true) {
          let chat_id = jkutil.getUniqueId()
          let ai_answer = ''
          await AiService.chat(options.text, (text, is_finished) => {
            ai_answer += text || ''
            room.broadcast('chat', {
              text: [text],
              user_id: 'ai',
              sender: 'AI',
              avatar: '/openai.png',
              chat_id: chat_id,
              option: 'stream',
              is_finished
            })
          })
          await knex('ChatMessage').insert({
            chat_room_id: room.room_id,
            text: JSON.stringify([ai_answer]),
            user_id: 'ai',
          })
        }
      }
      else if (options.images?.length > 0) {
        room.broadcast('chat', {
          images: options.images,
          user_id: this.user.id || 'guest',
          sender: this.user.nickname,
          avatar: this.user.avatar,
          chat_id: chat_id,
          stamp: Date.now()
        })
        await knex('ChatMessage').insert({
          chat_room_id: room.room_id,
          images: JSON.stringify(options.images),
          user_id: this.user.id,
        })
      }

    }
    else if (command == 'delete_chat') {
      debug('delete_chat', options.chat_id, this.user.id)
      assert(options.chat_id != null, 'no_chat_id')
      let chat = await knex('ChatMessage').where({
        id: options.chat_id,
        deleted: false,
      }).first()
      if (room.host_id != this.user.id && chat.user_id != this.user.id) {
        throw Error('not_allowed')
      }
      assert(chat != null, 'no_chat')
      let num_updated = await knex('ChatMessage').where('id', options.chat_id).update({
        deleted: true,
        updated_at: knex.fn.now(),
      })
      if (chat.images?.length > 0) {
        for (let image of chat.images) {
          await awsutil.trashImage(image)
        }
      }
      room.broadcast('delete_chat', {
        chat_id: options.chat_id,
      })
    }
  } catch (e) {
    this.sendCommand('error', { message: e.message })
    console.error('sendCommand Error : ', e)
  }
}

