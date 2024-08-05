import Debug from 'debug'
const debug = Debug('ankichampion:services:api_key')

import { knex } from '../util/knexutil.js'

export default {
  set: async (user_id, provider, api_key) => {
    let existing = await knex('APIKey').where('provider', provider).where('user_id', user_id).first()
    if (existing) {
      await knex('APIKey').update({
        api_key,
        updated_at: knex.fn.now()
      }).where('id', existing.id)
    } else {
      let result = await knex('APIKey').insert({
        user_id,
        provider,
        api_key,
      }).returning('id')
      return result
    }
  },
  delete: async (id) => {
    let result = await knex('APIKey').where('id', id).del()
    return result
  },
  list: async (user_id) => {
    let api_keys = await knex('APIKey').where('user_id', user_id)
    return api_keys
  },

}