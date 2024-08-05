import express from 'express'
const router = express.Router()
import jkutil from '../util/jkutil.js'
import Debug from 'debug'
const debug = Debug('ankichampion:routes:user')
import randomstring from 'randomstring'
import mailutil from '../util/mailutil.js'
import jio_mailutil from '../util/jio_mailutil.js'
import { knex } from '../util/knexutil.js'
import dayjs from 'dayjs'
import userService from '../services/user.js'
import socialLogin from '../services/socialLogin.js'

import i18n_helper from '../services/i18n_helper.js'

import rateLimit from 'express-rate-limit'
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1분
  max: 10,
  message: 'Too many request, please wait and try later',
})

import auth from '../services/auth.js'

import useragent from 'useragent'
import ws_server from '../websocket/ws_server.js'

router.get('/check_in', auth.getLang, auth.authUserNoThrow, async (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
  let result = { message: 'check_in' }
  if (req.user != null) {
    let user = await knex('User').where('id', req.user.id).first()
    if (user == null) {
      res.json({
        error: 'logout'
      })
      return
    }
    result.last_checkin_time = user.updated_at
    let agent = req.agent
    result.user_id = req.user.id
    await knex('User')
      .where('id', req.user.id)
      .update({
        checkin_count: knex.raw('checkin_count + 1'),
        updated_at: knex.fn.now(),
        lang: req.lang,
        os: `${agent.os.family} ${agent.os.major}.${agent.os.minor}`,
        browser: `${agent.family} ${agent.major}.${agent.minor}`,
      })
    if (user.lang != req.lang) {
      let chat_rooms = ws_server.getInstance().getJoinedChatRooms(req.user.id)
      for (let chat_room of chat_rooms) {
        chat_room.updateTranslateLanguage()
      }
    }
    result.nickname = user.nickname
    result.role = user.role
    result.user_id = req.user.id
    result.need_logout = (req.user.ver || 0) < 1
    let udid = req.headers['x-udid']
    let push = await knex('WebPush').where('user_id', user.id).where('udid', udid).first()
    result.push = push !== null
  }
  //let maintenance_message
  res.json(result)
})
// 자기정보
router.get('/me', auth.authUser, async (req, res, next) => {
  try {
    let udid = req.headers['x-udid']
    let results = await userService.getMe(req.user.id, udid)
    // let results = await knex('User').where('id', req.query.id).first()
    res.json(results)
  } catch (err) {
    debug(`get error ${err.message}`)
    next(err, req, res, next)
  }
})

// 자기정보 변경
router.post('/me', auth.authUser, async (req, res, next) => {
  try {
    let results = await userService.updateMe(req.user.id, req.body.key, req.body.value)
    // let results = await knex('User').where('id', req.query.id).first()
    res.json(results)
  } catch (err) {
    debug(`get error ${err.message}`)
    next(err, req, res, next)
  }
})

// 다른 유저 정보
router.get('/', auth.authUser, async (req, res, next) => {
  try {
    let results = await userService.get(req.query.use_id)
    // let results = await knex('User').where('id', req.query.id).first()
    res.json(results)
  } catch (err) {
    debug(`get error ${err.message}`)
    next(err, req, res, next)
  }
})

router.get('/login', limiter, auth.getLang, async (req, res, next) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    let user
    debug('tempToken', req.query)
    let temp_token = req.query.temp_token
    let host = req.query.host
    let socialUser
    if (req.query.type == 'email') {
      if (temp_token != null) {
        // let userTempToken = await knex('TempToken').where('temp_token', temp_token).first()
        // if (userTempToken == null) throw new Error('user temp token not found')
        user = await knex('User').select('User.*', 'TempToken.login_code as login_code', 'TempToken.updated_at as temp_token_updated_at').where('TempToken.temp_token', temp_token).join('TempToken', 'User.id', 'TempToken.user_id').first()
      } else {
        if (req.query.email != null && req.query.login_code != null) {
          user = await knex('User').select('User.*', 'TempToken.login_code as login_code', 'TempToken.updated_at as temp_token_updated_at').where({
            'TempToken.login_code': req.query.login_code,
            'User.email': req.query.email,
            'TempToken.used': false,
          }).join('TempToken', 'User.id', 'TempToken.user_id').first()

        } else {
          throw new Error('no_login_code')
        }
      }
      if (user == null) {
        // throw new Error('wrong_login_code')
        res.json({
          error: 'wrong_login_code'
        })
        return
      }
      let minutesElapsed = dayjs().diff(user.temp_token_updated_at, 'minute')
      debug('diff: ' + minutesElapsed)
      if (minutesElapsed > 10) {
      // if (minutesElapsed > 550) {
        throw new Error('expired_temp_token')
      }
      await knex('TempToken').where('user_id', user.id).update({ used: true })
    } else {
      if (temp_token == null) throw new Error('no temp token')
      let origin
      if (host == 'localhost') {
        origin = 'http://localhost:9099'
      } else {
        origin = 'https://api.ankichampion.com:9099'
      }
      socialUser = await socialLogin.getUser(temp_token, req.query.type, origin, host)
      //debug(req.query.type, "user", JSON.stringify(user, null, 4))

      user = await knex('User').where('social_type', req.query.type).where('social_id', socialUser.id).first()
      if (user != null) {
        // 새 소셜 타입으로 업데이트 소셜 로그인은 하나만 가지돼 바뀔 마다 업데이트 하는 방식으로
        await knex('User')
          .where('id', user.id)
          .update({
            os: `${req.agent.os.family} ${req.agent.os.major} ${req.agent.os.minor}`,
            browser: `${req.agent.family} ${req.agent.major}.${req.agent.minor}`,
            nickname: socialUser.nickname,
            age_range: socialUser.age_range,
            avatar: socialUser.photo,
            login_count: user.login_count + 1,
            ip: ip,
          })
      } else {
        if (socialUser.email != null) {
          // 소셜로그인 하려는 유저가 기존에 이메일이 있는지 확인
          user = await knex('User').where('email', socialUser.email).first()
          if (user != null) {
            // 새 소셜 타입으로 업데이트 소셜 로그인은 하나만 가지돼 바뀔 마다 업데이트 하는 방식으로
            await knex('User')
              .where('id', user.id)
              .update({
                os: `${req.agent.os.family} ${req.agent.os.major} ${req.agent.os.minor}`,
                browser: `${req.agent.family} ${req.agent.major}.${req.agent.minor}`,
                nickname: socialUser.nickname || socialUser.name,
                social_type: req.query.type,
                social_id: socialUser.id,
                avatar: socialUser.photo,
                login_count: user.login_count + 1,
                age_range: socialUser.age_range,
                ip: ip,
              })
          }
        }
      }


      if (user == null) {
        // 새 유저 생성
        let random_name = randomstring.generate({ length: 16, charset: 'alphanumeric' })
        let [user_id] = await knex('User').insert({
          id: jkutil.getUniqueId(),
          os: `${req.agent.os.family} ${req.agent.os.major} ${req.agent.os.minor}`,
          browser: `${req.agent.family} ${req.agent.major}.${req.agent.minor}`,
          lang: req.lang,
          nickname: socialUser.nickname || random_name,
          social_type: req.query.type,
          social_id: socialUser.id,
          email: socialUser.email,
          age_range: socialUser.age_range,
          ip: ip,
        })
        user = await knex('User').where('id', user_id).first()
        debug('creating new user' + user.id)
      }
    }
    debug('user:' + user.id)
    let token = auth.generateJWT(user.id, user.nickname, user.email, user.mobile, user.social_type, user.role, user.preview_level)
    // if(user.agree_terms_and_privacy !== true) {
    // 	if(req.query.agree_terms_and_privacy === true || req.query.agree_terms_and_privacy === 'true') {
    // 		await knex('User').update({
    // 			agree_terms_and_privacy : true,
    // 			agree_push : req.query.agree_push != null ? JSON.parse(req.query.agree_push) : false
    // 		})
    // 	} else {
    // 		res.json({
    // 			terms_and_privacy_agree : false,
    // 		})
    // 		return	
    // 	}
    // }

    res.json({
      user_id: user.id,
      is_success: true,
      token,
      email: user.email,
      mobile: user.mobile,
      social_type: user.social_type,
      nickname: socialUser?.name != null ? socialUser.name : user.nickname,
      avatar: socialUser != null ? socialUser.photo : user.avatar,
      plan: user.plan,
      role: user.role,
      agree_terms_and_privacy: user.agree_terms_and_privacy,
      push_agree: user.push_agree,
    })
  } catch (err) {
    console.error('error', err.message)
    console.error('stack', err.stack)
    next(err, req, res, next)
    // res.status(400).send({ message: e.message })
  }
})

router.post('/request_login_code', limiter, auth.getLang, async (req, res, next) => {
  try {
    let email = req.body.email
    if (email == null) {
      throw new Error('no email')
    } else if (jkutil.isValidEmail(email) == false) {
      throw new Error('invalid_email')
    }
    debug('req.headers.host', req.headers.host)
    debug('req.headers.host', req.headers.host.split(':')[0])
    debug('req.headers.origin', req.headers.origin)
    debug('req.headers.referer', req.headers.referer)

    let site = i18n_helper.getTranslation('title', req.lang)
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    let agent = useragent.parse(req.headers['user-agent'])
    let temp_token = jkutil.getUniqueId()
    // let user = await knex('User').where('email', email).where('deleted', false).first()
    let user = await knex('User').where('email', email).first()
    let login_code
    let user_id
    if (user == null) {
      let nickname = await jkutil.getUniqueNickName(email)
      user_id = jkutil.getUniqueId()
      let insertData = {
        id: user_id,
        nickname: nickname,
        os: `${agent.os.family} ${agent.os.major} ${agent.os.minor}`,
        browser: `${agent.family} ${agent.major}.${agent.minor}`,
        lang: req.lang,
        ip: ip,
        email: email,
      }
      let result = await knex('User').insert(insertData)
      user = await knex('User').where('id', result[0]).first()
      debug('new user created', user.id, user.email)
    }
    else if (user.deleted === true) {
      let nickname = await jkutil.getUniqueNickName(email)
      user_id = user.id
      await knex('User').where('id', user.id).update({
        updated_at: knex.fn.now(),
        deleted: false,
        nickname: nickname,
        os: `${agent.os.family} ${agent.os.major} ${agent.os.minor}`,
        browser: `${agent.family} ${agent.major}.${agent.minor}`,
        lang: req.lang,
        ip: ip,
      })
    }
    else {
      if (user.email == 'test@codingpen.com') {
        let config = await knex('Config').where('key', 'test_user_login_code').first()
        login_code = config.value
      }
      user_id = user.id
    }

    // 초대된 방이 있을 경우 그 방의 멤버로 만들어준다.
    let invites = await knex('Invite').where('email', user.email).where('deleted', false)
    for (let invite of invites) {
      let chat_room = await knex('ChatRoom').where('id', invite.chat_room_id).first()
      if (chat_room == null) continue // 채팅방이 없으면 무시
      await knex('ChatRoomMember').insert({
        chat_room_id: invite.chat_room_id,
        user_id: user.id,
      })
      let ws_chat_room = await ws_server.getInstance().getRoom('chat_room', invite.chat_room_id, false)
      ws_chat_room.members.push({
        user_id: user.id,
        nickname: user.nickname,
      })


      await knex('Invite').where('id', invite.id).update('deleted', true)
    }

    if (login_code == null) {
      login_code = randomstring.generate({ length: 6, charset: 'numeric' })
      debug('login_code', login_code)
    }

    await knex('TempToken')
      .insert({
        user_id: user_id,
        temp_token,
        login_code,
        updated_at: knex.fn.now(),
        used: false,
      })
      .onConflict('user_id')
      .merge()

    debug('created temptoken')
    let mailResult = await jio_mailutil.sendMail(
      email,
      i18n_helper.getTranslation('sign_in_mail_title', req.lang).replace('${site}', site),
      null,
      i18n_helper.getTranslation('sign_in_mail_content', req.lang).replace('${code}', login_code).replace('${site}', site)
    )
    debug(`mailResult: ${mailResult}`)
    await knex('ErrorLog').insert({
      type: 'mailResult',
      message: mailResult,
    })
    res.json({
      is_success: true,
      contact: email,
    })
  } catch (e) {
    debug(`error ${e.message}`)
    debug(`error ${e.stack}`)
    res.status(400).send({ message: e.message })
  }
})

router.post('/agree_terms', async (req, res, next) => {
  try {
    let result = await userService.agreeTerms(req.body.user_id, req.body.agree_terms_and_privacy, req.body.agree_push)
    res.json(result)
  } catch (e) {
    debug(`error ${e.message}`)
    debug(`error ${e.stack}`)
    res.status(400).send({ message: e.message })
  }
})

router.delete('/', auth.authUser, async (req, res, next) => {
  try {
    const result = await userService.delete(req.user.id)
    res.json(result)
  } catch (err) {
    debug('Error in delete: ', err.message)
    next(err)
  }
})

// 0auth 서버에서 인증이 끝나고 호출됨
// type : google, kakao 등등
router.get('/oauth/:type/:from_host', async (req, res, next) => {
  try {
    let host = 'https://ankichampion.com/'
    if (req.params.from_host.indexOf('localhost') >= 0) {
      host = 'http://localhost:9099/'
    }

    let redirect_uri = `${host}#/login?tempToken=${req.query.code}&type=${req.params.type.toLowerCase()}&host=${req.params.from_host}`
    debug('redirect', redirect_uri)
    res.redirect(redirect_uri)
  } catch (err) {
    debug(`get error ${err.message}`)
    next(err, req, res, next)
  }
})

router.post('/web_push', auth.authUser, async (req, res, next) => {
  try {
    let udid = req.headers['x-udid']
    let result = await userService.registerWebPush(req.user.id, udid, req.body.subscription)
    res.json(result)
  } catch (e) {
    debug(`error ${e.message}`)
    res.status(400).send({ message: e.message })
  }
})

router.delete('/web_push', auth.authUser, async (req, res, next) => {
  try {
    let udid = req.headers['x-udid']
    let result = await userService.deleteWebPush(req.user.id, udid)
    res.json(result)
  } catch (e) {
    debug(`error ${e.message}`)
    res.status(400).send({ message: e.message })
  }
})


export default router
