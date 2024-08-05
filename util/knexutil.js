import Debug from 'debug'
const debug = Debug('ankichampion:knexutil')

import config from './config.js'
import Knex from 'knex'
const knex = Knex(config.db)

debug('db_user', process.env.ANKI_CHAMPION_DEV_DB_USER)

// 30분 간격으로 ping 을 해서 db가 죽지 않도록 한다.
// 이상하게 시간이 지나면 ECONNRESET에러가 발생해서 하는 임시조치
setInterval(async () => {
	debug('ping mysql')
	await knex.raw('select 1')
}, 1000 * 60 * 30)



export { knex }
