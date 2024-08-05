import Debug from 'debug'
const debug = Debug('ankichampion:services:chat_room')
import assert from 'assert'

import { knex } from '../util/knexutil.js'
import jkutil from '../util/jkutil.js'
import ws_server from '../websocket/ws_server.js'
import i18n_helper from './i18n_helper.js'
import mailutil from '../util/mailutil.js'

const chatRoomService = {
  getMyRoom: async (my_user_id) => {
    let user = await knex('User').where('id', my_user_id).first()
    return user
  },

  getNumMembers: async (chat_room_id) => {
    let { count } = await knex('ChatRoomMember').where({
      chat_room_id: chat_room_id,
      'ChatRoomMember.deleted': false,
    }).count('user_id as count').first()
    return count
  },

  findMember: async (chat_room_id, user_id) => {
    console.log(knex('ChatRoomMember')
      .where({
        'ChatRoomMember.chat_room_id': chat_room_id,
        'ChatRoomMember.deleted': false,
        'ChatRoomMember.user_id': user_id,
      })
      .join('User', 'ChatRoomMember.user_id', 'User.id')
      .select('User.id as user_id', 'User.nickname as nickname', 'User.email as email', 'ChatRoomMember.id as member_id', 'ChatRoomMember.enter_count as enter_count')
      .toQuery())
    const existing = await knex('ChatRoomMember')
      .where({
        'ChatRoomMember.chat_room_id': chat_room_id,
        'ChatRoomMember.deleted': false,
        'ChatRoomMember.user_id': user_id,
      })
      .join('User', 'ChatRoomMember.user_id', 'User.id')
      .select('User.id as user_id', 'User.nickname as nickname', 'User.email as email', 'ChatRoomMember.id as member_id', 'ChatRoomMember.enter_count as enter_count')
      .first()
    return existing
  },

  getMembers: async (chat_room_id) => {
    const members = await knex('ChatRoomMember').where({
      'ChatRoomMember.chat_room_id': chat_room_id,
      'ChatRoomMember.deleted': false,
    })
      .join('User', 'ChatRoomMember.user_id', 'User.id')
      .select('User.id as user_id', 'User.nickname as nickname', `ChatRoomMember.id as member_id`)
    return members
  },

  updateMemberEnterCount: async (chat_room_id, user_id) => {
    try {
      await knex('ChatRoomMember').where({
        'chat_room_id': chat_room_id,
        'user_id': user_id,
      }).increment('enter_count', 1)
    } catch (e) {
      console.error(e)
    }
  },

  // 내가 개설한 챗방 목록
  getMyChatList: async ({ user_id, page, rowsPerPage, sortBy, descending, filter }) => {
    let sortDirection = descending ? 'desc' : 'asc'
    let query = knex('ChatRoom').where('host_id', user_id).andWhere('deleted', false).orderBy(sortBy, sortDirection)

    if (filter != null && filter.length > 0) {
      query.where('nickname', 'like', `%${filter}%`)
    }

    if (rowsPerPage != null && rowsPerPage > 0) {
      query.limit(rowsPerPage)
    }
    if (page != null && page > 0) {
      query.offset(rowsPerPage * (page - 1))
    }
    let chats = await query
    for (let chat of chats) {
      let { member_count } = await knex('ChatRoomMember').count('user_id as member_count').where({
        chat_id: chat.id,
        deleted: false,
      }).first()
      chat.member_count = member_count
    }
    let { count } = await knex('ChatRoom').count('host_id as count').where('host_id', user_id).andWhere('deleted', false).first()
    return { chats, count }
  },

  // 전체 챗방 목록
  getPublicRooms: async ({ user_id, page, rowsPerPage, sortBy, descending, filter }) => {
    let sortDirection = descending ? 'desc' : 'asc'
    let query = knex('ChatRoom').where('ChatRoom.deleted', false).orderBy(sortBy, sortDirection).select('ChatRoom.*').leftJoin('User', 'ChatRoom.host_id', 'User.id').select('User.nickname as host', 'User.avatar as avatar')

    if (filter != null && filter.length > 0) {
      query.where('nickname', 'like', `%${filter}%`)
    }

    if (rowsPerPage != null && rowsPerPage > 0) {
      query.limit(rowsPerPage)
    }
    if (page != null && page > 0) {
      query.offset(rowsPerPage * (page - 1))
    }
    let chat_rooms = await query
    for (let chat_room of chat_rooms) {
      let { member_count } = await knex('ChatRoomMember').count('user_id as member_count').where({
        chat_room_id: chat_room.id,
        deleted: false,
      }).first()
      chat_room.member_count = member_count
      if (chat_room.password?.length > 0)
        chat_room.has_password = true
      else
        chat_room.has_password = false
      delete chat_room.password
    }
    let { count } = await knex('ChatRoom').count('host_id as count').where('host_id', user_id).andWhere('deleted', false).first()
    return { chat_rooms, count }
  },

  getJoinedRooms: async ({ user_id, page, rowsPerPage, sortBy, descending, filter }) => {
    if (sortBy == null) sortBy = 'id'
    let sortDirection = descending ? 'desc' : 'asc'

    let query = knex('ChatRoomMember')
      .select('ChatRoomMember.chat_room_id as id')
      .leftJoin('ChatRoom', 'ChatRoomMember.chat_room_id', 'ChatRoom.id')
      .select("ChatRoom.name as name")
      .leftJoin('User', 'ChatRoomMember.user_id', 'User.id')
      .select('User.avatar as avatar')
      .where({
        'ChatRoomMember.user_id': user_id,
        'ChatRoom.deleted': false,
        'ChatRoomMember.deleted': false,
      })
      .orderBy(`ChatRoomMember.${sortBy}`, sortDirection)

    if (filter != null && filter.length > 0) {
      query.where('ChatRoom.name', 'like', `%${filter}%`)
    }

    if (rowsPerPage != null && rowsPerPage > 0) {
      query.limit(rowsPerPage)
    }
    if (page != null && page > 0) {
      query.offset(rowsPerPage * (page - 1))
    }
    let chat_rooms = await query
    for (let chat_room of chat_rooms) {
      let { member_count } = await knex('ChatRoomMember').count('ChatRoomMember.user_id as member_count').where({
        chat_room_id: chat_room.id,
        deleted: false,
      }).first()
      chat_room.member_count = member_count
      let chat_room_data = await knex('ChatRoom').where('ChatRoom.id', chat_room.id).leftJoin('User', 'ChatRoom.host_id', 'User.id').select('User.nickname as host').first()
      chat_room.host = chat_room_data.host
    }

    let { count } = await knex('ChatRoomMember').count('user_id as count', user_id).where({
      user_id: user_id,
      deleted: false
    }).first()
    return { chat_rooms, count }
  },

  // host_id 이게 지랄 맏은게 host_id 이렇게 넣으면 제대로 안들어감.
  create: async (host_id, name) => {
    let rooms = await knex('ChatRoom').where('name', name).where('host_id', host_id).where('deleted', false)
    let user = await knex('User').where('id', host_id).first()
    assert(user != null, 'no user')
    assert(rooms.length <= user.max_chat_rooms, 'max_chat_rooms')
    let existing = rooms.find((room) => room.name == name)
    assert(existing == null, 'existing_chat_room')

    let chat_room_id = await knex.transaction(async (trx) => {
      let id = 'c' + jkutil.getUniqueId()
      let created = await trx('ChatRoom').insert({
        id,
        name,
        host_id,
        staff_ids: '[]',
      })
      await trx('ChatRoomMember').insert({
        user_id: host_id,
        chat_room_id: id,
      })
      // chat.member_count = 0
      return id
    })
    let chat = await knex('ChatRoom').where('id', chat_room_id).first()
    return chat
  },

  update: async (chat_room_id, key, value) => {
    let data = { [key]: value }
    data.updated_at = knex.fn.now()
    let num_updated = await knex('ChatRoom').update(data).where('id', chat_room_id)
    let chat_room = await ws_server.getInstance().getRoom('chat_room', chat_room_id, false)
    if (chat_room != null) {
      chat_room[key] = value
    }
    return num_updated
  },

  delete: async (user_id, chat_room_id) => {

    let result = await knex.transaction(async (trx) => {
      await trx('ChatRoom').where('host_id', user_id).where('id', chat_room_id).update('deleted', true)
      await trx('ChatRoomMember').where('chat_room_id', chat_room_id).update('deleted', true)
      await trx('ChatMessage').where('chat_room_id', chat_room_id).update('deleted', true)
    })
    return result
  },

  // JSON_ARRAYAGG
  get: async ({ user_id, chat_room_id, page, rowsPerPage, sortBy, descending, filter, language }) => {
    let joined = await knex('ChatRoomMember').where({
      user_id,
      chat_room_id,
      deleted: false,
      expelled: false,
    }).first()
    assert(joined != null, 'not_joined')
    let chat_room = await knex('ChatRoom').where('ChatRoom.id', chat_room_id)
      .select('ChatRoom.*')
      .leftJoin('User', 'ChatRoom.host_id', 'User.id')
      .select('User.nickname as host', 'User.avatar as owner_avatar')
      .first()

    assert(chat_room != null, 'chat_room not found')
    if (chat_room.host_id != user_id) {
      let chat_member = await knex('ChatRoomMember')
        .where({
          chat_room_id: chat_room_id,
          user_id: user_id,
        }).first()
      if (chat_member == null) {
        // throw new Error('not_joined')
      }
    }
    chat_room.members = await knex('ChatRoomMember')
      .leftJoin('User', 'ChatRoomMember.user_id', 'User.id')
      .select('User.nickname as nickname', 'User.avatar as avatar', 'ChatRoomMember.user_id')
      .where({
        'ChatRoomMember.chat_room_id': chat_room_id,
        'ChatRoomMember.deleted': false,
        'User.deleted': false,
      })
      .orderBy('ChatRoomMember.created_at', 'asc')

    chat_room.invitees = await knex('Invite').where('chat_room_id', chat_room_id).where('deleted', false).orderBy('created_at', 'desc')

    let chats = await knex('ChatMessage').where('chat_room_id', chat_room_id).where('ChatMessage.deleted', false)
      .join('User', 'ChatMessage.user_id', 'User.id')
      .select('ChatMessage.id as chat_id', 'ChatMessage.text as text', 'ChatMessage.images as images', 'ChatMessage.language as language', 'ChatMessage.translated', 'ChatMessage.created_at as stamp', 'User.nickname as sender', 'User.avatar as avatar', 'User.id as user_id'
        // ,knex.raw(`CASE WHEN User.id = ? THEN true ELSE false END as is_me`, [user_id])
      )
      .orderBy('ChatMessage.created_at', 'asc').limit(50)

    // chats.forEach((chat) => {
    // 	chat.is_me = chat.user_id == user_id
    // })
    if (chats.length == 0) {
      // chats.push({
      //   text: [`Welcome to ${chat_room.name}!`],
      //   sender: '코딩펜',
      //   is_me: false,
      //   avatar: 'https://hanform.s3-ap-northeast-2.amazonaws.com/logo_codingpen.svg',
      // })
    } else {
      for (let chat of chats) {
        if (chat.language !== language && chat.translated != null) {
          // 없으면 영어로 된 번역을 우선 보여줌, 나중에는 추가하는 방향을 검토
          let translated = chat.translated[language] || chat.translated['en']
          chat.text.push(translated)
        }
        // if (chat.user_id == 'ai') {
        //   chat.avatar = '/openai.png'
        // }
        // else if (chat.user_id == 'system') {
        //   chat.avatar = '/system.svg'
        // }
      }
    }
    return { chat_room, chats }
  },

  joinUser: async (user_id, chat_room_id, password) => {
    assert(user_id != null, 'no user_id')
    assert(chat_room_id != null, 'no chat_room_id')
    let joined = await knex('ChatRoomMember').where({
      user_id: user_id,
      chat_room_id: chat_room_id,
      deleted: false,
    }).first()
    if (joined != null) {
      throw new Error('already_joined')
    }
    let chat_room = await knex('ChatRoom').where('id', chat_room_id).first()
    assert(chat_room != null, 'no chat_room')
    if (chat_room.password?.length > 0) {
      if (chat_room.password != password) {
        throw new Error('password_mismatch')
      }
    }
    let result = await knex('ChatRoomMember').insert({
      user_id,
      chat_room_id,
    })

    return {
      created_id: result[0], // 추가된 id
      chat_room_id: chat_room_id
    }
  },

  inviteUser: async (user_id, user_nickname, user_lang, chat_room_id, invitee_email_address) => {
    assert(user_id != null, 'no user_id')
    assert(chat_room_id != null, 'no chat_room_id')
    assert(invitee_email_address != null, 'no invitee_email_address')
    let chat_room = await knex('ChatRoom').where('id', chat_room_id).where('host_id', user_id).first()
    assert(chat_room != null, 'no chat_room')

    let joined = await knex('ChatRoomMember').leftJoin('User', 'ChatRoomMember.user_id', 'User.id')
      .where({
        'ChatRoomMember.chat_room_id': chat_room_id,
        'ChatRoomMember.deleted': false,
        'User.email': invitee_email_address,
        'User.deleted': false,
      })
      .first()
    if (joined != null) {
      throw new Error('already_joined')
    }
    let result, invite_id
    let invitee = await knex('User').where('email', invitee_email_address).where('deleted', false).first()
    if (invitee != null) {
      await knex('ChatRoomMember').insert({
        user_id: invitee.id,
        chat_room_id,
      })
      result = i18n_helper.getTranslation('invited', user_lang).replace('${nickname}', invitee.nickname)
    } else {
      // TODO 가입 직후 초대 목록을 확인해서 처리할 것.
      let existing = await knex('Invite').where({
        email: invitee_email_address,
        chat_room_id,
        deleted: false,
      }).first()

      if (existing == null) {
        const inserted = await knex('Invite').insert({
          chat_room_id,
          email: invitee_email_address,
        })
        invite_id = inserted[0]
      } else {
        await knex('Invite').update({
          invite_count: existing.invite_count + 1,
          updated_at: knex.fn.now(),
        }).where({
          id: existing.id
        })
      }
      const site = 'ankichampion'
      const to_address = invitee_email_address
      const subject = `${site} 채팅방 (${chat_room.name})에 ${user_nickname}님이 초대하셨습니다.(Your invited to the chat room)`
      const text = null

      let server = process.env.NODE_ENV == 'dev' ? 'http://localhost:9099' : 'https://ankichampion.com'
      const html = `${chat_room.name} <p>채팅방 초청을 수락하시려면 아래 링크를 방문해주세요</p><br>` +
        `<strong><pre>${server}/#/chat_room/${chat_room_id}</pre></strong> <p>감사합니다</p> <p>${site} 팀</p>`
      let mailResult = await mailutil.sendMail(
        to_address,
        subject,
        null,
        html,
      )
      if (mailResult == true)
        result = '비회원이라서 초대 메일을 보냈습니다.(Sent invitation)'
      else
        result = '초대 이메일을 보내는데 에러가 생겼습니다.(Error sending email)'
    }

    return {
      message: result,
      invitee: {
        invite_id: invite_id,
        user_id: invitee?.id,
        nickname: invitee?.nickname,
        email: invitee_email_address,
        avatar: invitee?.avatar,
      }
    }
  },

  deleteMember: async (user_id, chat_room_id, member_user_id) => {
    await knex.transaction(async (trx) => {
      let chat_room = await knex('ChatRoom').where('id', chat_room_id).first()
      assert(chat_room != null, 'no chat_room')

      let chat_room_member = await chatRoomService.findMember(chat_room_id, member_user_id)
      assert(chat_room_member != null, 'no chat_room_member')
      if (member_user_id == chat_room.host_id) {
        throw new Error('cannot_delete_host')
      }
      if (user_id == chat_room.host_id || user_id == member_user_id) {
        let num_deleted = await knex('ChatRoomMember').where({
          chat_room_id,
          user_id: member_user_id,
        }).update({
          deleted: true,
          updated_at: knex.fn.now(),
        })
        let ws_chat_room = await ws_server.getInstance().getRoom('chat_room', chat_room_id, false)
        await ws_chat_room.expelUser(member_user_id, chat_room_member.nickname)
        return { num_deleted }
      }
      throw new Error('not_allowed')
    })
    return { message: 'deleted' }
  },

  deleteInvitee: async (user_id, chat_room_id, invitee_id) => {
    let chat_room = await knex('ChatRoom').where('id', chat_room_id).where('host_id', user_id).first()
    assert(chat_room != null, 'no chat_room')
    await knex('Invite').where('id', invitee_id).del()
  },
}

export default chatRoomService