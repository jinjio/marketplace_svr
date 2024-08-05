import Debug from 'debug'
const debug = Debug('ankichampion:services:user')
import assert from 'assert'

import { knex } from '../util/knexutil.js'

export default {
  agreeTerms: async (user_id, agree_terms_and_privacy, agree_push) => {
    let num_updated = await knex('User').update({
      agree_terms_and_privacy,
      agree_push,
      updated_at: knex.fn.now()
    }).where('id', user_id)
    return { num_updated }
  },
  getMe: async (my_user_id, udid) => {
    assert(my_user_id != null, 'my_user_id is required')
    let user = await knex('User').where('id', my_user_id).first()
    let push = await knex('WebPush').where('user_id', my_user_id).where('udid', udid).first()
    user.push = push != null
    return user
  },

  updateMe: async (my_user_id, key, value) => {
    assert(my_user_id != null, 'my_user_id is required')
    let user = await knex('User').where('id', my_user_id).update(key, value)
    return user
  },

  get: async (user_id) => {
    assert(user_id != null, 'user_id is required')
    let user = await knex('User').where('id', user_id)
      .select('nickname', 'created_at').first()
    return user
  },

  delete: async (user_id) => {
    assert(user_id != null, 'user_id is required')
    let result = await knex.transaction(async (trx) => {
      let num_updated = await trx('User').where('id', user_id).update({
        deleted: true,
        updated_at: knex.fn.now(),
        deleted_at: knex.fn.now(),
      })
      // 탈퇴하는 유저가 참가한 챗방에서 빠져나가기 처리
      await trx('ChatRoomMember').update({
        'deleted': true,
        updated_at: knex.fn.now(),
      }).where('user_id', user_id)
      // 탈퇴하는 유저가 개설한 챗방도 삭제 처리
      await trx('ChatRoom').update({
        'deleted': true,
        updated_at: knex.fn.now(),
      }).where('host_id', user_id)
      return num_updated
    })
    return result
  },

  registerWebPush: async (user_id, udid, subscription) => {
    assert(user_id != null, 'user_id is required')
    assert(subscription != null, 'subscription is required')

    let existing = await knex('WebPush').where('user_id', user_id).where('udid', udid).first()
    if (existing == null) {
      let result = await knex('WebPush').insert({
        user_id,
        udid,
        subscription: JSON.stringify(subscription),
        updated_at: knex.fn.now()
      })
      return {
        result: 'created'
      }
    } else {
      await knex('WebPush').update({
        subscription: JSON.stringify(subscription),
        updated_at: knex.fn.now()
      }).where('id', existing.id)
      return {
        result: 'updated'
      }
    }
  },
  deleteWebPush: async (user_id, udid) => {
    let result = await knex('WebPush').where('user_id', user_id).where('udid', udid).del()
    return {
      result
    }
  },
}