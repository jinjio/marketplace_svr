import Debug from 'debug'
const debug = Debug('ankichampion:services:user')

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
}