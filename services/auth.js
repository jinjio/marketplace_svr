import Debug from 'debug'
const debug = Debug('ankichampion:services:auth')
import useragent from 'useragent'
import jwt from 'jsonwebtoken'
import config from '../util/config.js'

function preprocessTestUser(req) {
  if (req.query.test_user == 'c8ccc57a-6945-4b9c-a572-5d96337ffff6') {
    req.user = {
      id: 1,
      os: 'osx',
    }
    return true
  }
  return false
}

function parseUserAgent(req) {
  const UserAgent = req.get('X-User-Agent')
  const arr = UserAgent.split(',')
  return {
    udid: arr[0],
    os: arr[1],
  }
}

parseUserAgent = (req, res, next) => {
  let agent = useragent.parse(req.headers['user-agent'])
  debug('agent', agent)
  req.agent = agent
  next()
}

function sendForbiddenError(req, res, next) {
  res.status(403).json({ error: 'Forbidden' })
}

async function authRequest(req, res, next, noThrow) {
  try {
    debug('authRequest')
    let authorization = req.get('Authorization')
    if (authorization != null) {
      // 'bearer ' 문자열 strip.
      const token = req.get('Authorization').substr(7)
      // debug('token: ', token)
      req.user = jwt.verify(token, config.jwt_secret)
      debug('verify ok')
    } else {
      debug('Authorization_not_found')
      throw new Error("Authorization_not_found")
    }
    next()
  } catch (e) {
    debug('authRequest jwt error', e.message)
    if (e.message == 'jwt expired') {
      res.status(403).json({ message: 'jwt_expired' })
    } else {
      if (noThrow == false) sendForbiddenError(req, res, next)
      else next()
    }
  }
}

export default {
  getLang: (req, res, next) => {
    try {
      let headerLanguage = req.headers['accept-language']
      if (headerLanguage != null) {
        req.lang = headerLanguage.split(',')[0].toLowerCase()
      }
      let agent = useragent.parse(req.headers['user-agent'])
      req.agent = agent
      return next()
    } catch (e) {
      req.lang = 'ko'
      console.error('getLang', e)
    }
  },
  authUser: (req, res, next) => {
    // 테스트 유저 인증 방법
    debug('authUser')
    if (preprocessTestUser(req)) {
      debug('  TestUser Auth OK')
      return next()
    }
    return authRequest(req, res, next, false)
  },
  authUserNoThrow: (req, res, next) => {
    debug('authUser')
    if (preprocessTestUser(req)) {
      debug('  TestUser Auth OK')
      return next()
    }
    return authRequest(req, res, next, true)
  },
  generateJWT: (id, nickname, email, mobile, social_type, role, preview_level) => {
    let now = Math.floor(Date.now() / 1000)
    return jwt.sign(
      {
        iss: 'ankichampion', // issuer 발행자
        iat: now, // 발행 시간 타임스탬프
        exp: now + 60 * 60 * 24 * 30 * 3, // 만료 시각 : 3개월후
        //exp: now + 60 * 1, // 만료 시각 : 1분후
        id: id,
        nickname: nickname,
        email, // 유저 아메일
        mobile,
        social_type,
        role: role,
        preview_level: preview_level,
        ver: 1,
      },
      config.jwt_secret
    )
  },
}