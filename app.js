import 'dotenv/config'

import Debug from 'debug'
const debug = Debug('marketplace:app')

// init express
import packagejson from './package.json' assert { type: 'json'}

import express from 'express'
const app = express()

import cors from 'cors'
app.use(cors())
app.use(express.json())

import fileUpload from 'express-fileupload'
app.use(
  fileUpload({
    limits: { fileSize: 2 * 1024 * 1024 },
    defCharset: 'utf8',
    defParamCharset: 'utf8'
  })
)

app.use((req, res, next) => {
  debug(`-----\n${req.method}, ${req.originalUrl}`)
  next()
})


app.get('/', function (req, res, next) {
  res.send({
    app: 'marketplace',
    now: new Date(),
    ver: packagejson.version,
  })
})

import file_route from './routes/file.js'
app.use('/file', file_route)

import user_route from './routes/user.js'
app.use('/user', user_route)

import api_key_route from './routes/api_key.js'
app.use('/api_key', api_key_route)

import chat_room_route from './routes/chat_room.js'
app.use('/chat_room', chat_room_route)

import chat_route from './routes/chat.js'
app.use('/chat', chat_route)

import payment_route from './routes/payment.js'
app.use('/payment', payment_route)


console.log('DEBUG', process.env.DEBUG)

app.use((req, res, next) => {
  console.log(`Request received: ${req.method} ${req.url}`)
  next()
})


app.use(function (err, req, res, next) {
  console.error(err.stack)
  res.status(500).json({ message: err.message })
  // next(err, req, res, next)
})

import http from 'http'
const httpServer = http.createServer(app)
const PORT = 9099 || process.env.PORT
httpServer.listen(PORT, () => {
  debug(`🚀 AnkiChampion server ready at http://localhost:${PORT}`)
})

// export default app

// if (process.env.NODE_ENV !== 'production') {
//   const PORT = process.env.PORT || 9099
//   app.listen(PORT, () => {
//     console.log(`🚀 Server ready at http://localhost:${PORT}`)
//   })
// }




import ws_server from './websocket/ws_server.js'
ws_server.getInstance(httpServer)



/*
*/

// VAPID 키 설정

import webpush from 'web-push'

const vapidKeys = {
  publicKey: process.env.DARI_CHAT_WEB_PUSH_PUBLIC_KEY,
  privateKey: process.env.DARI_CHAT_WEB_PUSH_PRIVATE_KEY
}

webpush.setVapidDetails(
  'mailto:support@marketplace.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
)

// 구독 정보와 메시지를 사용하여 푸시 알림 전송
const pushSubscription = {
  "endpoint": "https://fcm.googleapis.com/fcm/send/dFdSlDPo4s8:APA91bHB4ehJMr5JoaEs964VA2jocG87ez0Z0MwdfTOfF6CgNKbecYCQ2ZgTkutHOsLGLqNOuCbHe7eWWgSHC4Q21ZKaSAlc6dgipNLwfKo6ag_JFzFcefm5F5SkaLkwwm2oDZ18S2P7",
  "expirationTime": null,
  "keys": {
    "p256dh": "BKfV4TgfVq5Hzx3_BrFyCQQpT5GWVel18rRevVW6_ALyLByK42gqiCG5BUCVmo3_RaaGEEoDYk2-QX2Hs4YDRcU",
    "auth": "qKBgYI2TFgo7jff40LB4lg"
  }
}


const payload = {
  title: '알림 테스트',
  body: '금일 저녁 메뉴는 마라탕입니다.',
  icon: 'home',
  tag: 'tag_test',
  url: 'https://ankichampion.com/chat_room/1',
}
  



/*
webpush.sendNotification(pushSubscription, JSON.stringify(payload))
  .then(function (response) {
    console.log('알림 전송 성공:', response)
  })
  .catch(function (error) {
    console.error('알림 전송 실패:', error)
  })
*/
