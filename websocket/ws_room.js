import Debug from 'debug'
const debug = Debug('ankichampion:ws_room')
import assert from 'assert'
import { knex } from '../util/knexutil.js'
import tranlationService from '../services/translation.js'
import jkutil from '../util/jkutil.js'
import chatRoomService from '../services/chat_room.js'

class WSRoom {
  constructor({ room_type, room_id }) {
    this.room_type = room_type
    this.room_id = room_id
    this.clients = []
    this.translation_languages = []
    this.is_public = false
    this.all_members = []
    this.offline_members = []
    this.online_members = []
  }

  async init() {
    let room_data = await knex('ChatRoom').where('id', this.room_id).first()
    assert(room_data != null, 'no_room_data')
    this.cover = room_data.cover
    this.password = room_data.password
    this.host_id = room_data.host_id
    this.staff_ids = room_data.staff_ids
    this.name = room_data.name
    this.use_translation = room_data.use_translation
    this.use_ai = room_data.use_ai

    this.offline_members = await knex('ChatRoomMember').where({
      'ChatRoomMember.deleted': false,
      'ChatRoomMember.expelled': false,
      'ChatRoomMember.chat_room_id': this.room_id,
    }).leftJoin('User', 'User.id', 'ChatRoomMember.user_id').select('ChatRoomMember.user_id as user_id', 'User.lang as lang')

    if (this.use_translation) {
      this.updateTranslateLanguage()
    }

    this.plugins = room_data.plugins
    if (this.plugins?.translate?.length > 0) {
      for (let translate of this.plugins?.translate) {
        this.translations.add(translate.lang)
      }
    }
  }

  broadcast(command, options, my_id, my_data) {
    for (let client of this.clients) {
      if (my_id != null && my_data != null && client.user.id == my_id) {
        options = Object.assign({}, options, my_data)
      }
      client.sendCommand(command, options)
    }
  }

  async joinClient(client) {
    this.clients.push(client)
    client.room = this
    let offline_member_index = this.offline_members.findIndex(item => item.user_id == client.user.id)
    this.online_members.push(this.offline_members[offline_member_index])
    this.offline_members.splice(offline_member_index, 1)
    if (client.user.enter_count == 0) {
      debug('새로운 회원 들어옴')
      let chat_id = jkutil.getUniqueId()
      let text = [`${client.user?.nickname}님이 들어왔습니다.`]
      this.broadcast('chat', {
        text: text,
        user_id: 'system',
        sender: 'system',
        avatar: '/system.svg',
        // option: 'stream',
      })
      await knex('ChatMessage').insert({
        chat_room_id: this.room_id,
        text: JSON.stringify(text),
        user_id: 'system',
      })
    }
  }

  async updateTranslateLanguage() {
    debug('updateTranslateLanguage-1', this.translation_languages)
    let translate_language_list = await knex('ChatRoomMember')
      .where({
        'chat_room_id': this.room_id,
        'ChatRoomMember.deleted': false,
      })
      .leftJoin('User', 'ChatRoomMember.user_id', 'User.id')
      .select('User.lang', 'User.nickname')
    translate_language_list = translate_language_list.map(item => tranlationService.getTranslateLanguageFor(item.lang, item.nickname)) || []
    // 중복언어 제거
    this.translation_languages = [...new Set(translate_language_list)]
    debug('updateTranslateLanguage-2', this.translation_languages)
  }

  leaveClient(client) {
    jkutil.arrRemove(this.clients, client)
    let online_member_index = this.online_members.findIndex(item => item.user_id == client.user.id)
    this.offline_members.push(this.online_members[online_member_index])
    this.online_members.splice(online_member_index, 1)

    this.offline_members = this.offline_members.filter(item => item.user_id != client.user.id)
    debug('leaveClient', this.clients)
  }

  getPlayer(user_id) {
    return this.clients.find(item => item.user.id == user_id)
  }

  async expelUser(user_id, nickname) {
    let chat_id = jkutil.getUniqueId()
    let text = [`${nickname}님이 나갔습니다.`]
    this.broadcast('chat', {
      text: text,
      user_id: 'system',
      sender: 'system',
      avatar: '/system.svg',
      chat_id: chat_id,
      // option: 'stream',
    })
    await knex('ChatMessage').insert({
      chat_room_id: this.room_id,
      text: JSON.stringify([text]),
      user_id: 'system',
    })
    // 접속중이라면 내보낸다.
    // let client = this.getPlayer(user_id)
    let client = this.clients.find(item => item.user.id == user_id)
    if (client) {
      client.sendCommand('exit', {})
      this.clients = this.clients.filter(item => item.user.id != user_id)
      debug('remain clients', this.clients.length)
    }
  }
}

export default WSRoom 