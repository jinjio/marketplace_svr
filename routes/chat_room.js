import Debug from 'debug'
const debug = Debug('ankichampion:routes:chat_room')

import express from 'express'
const router = express.Router()
export default router

import chatRoomService from '../services/chat_room.js'
import auth from '../services/auth.js'


router.use('/', auth.authUser)

router.get('/', auth.getLang, async (req, res, next) => {
  try {
    const result = await chatRoomService.get({
      user_id: req.user.id,
      chat_room_id: req.query.chat_room_id,
      language: req.lang
    })
    res.json(result)
  } catch (err) {
    debug('Error in GET /', err.message)
    next(err)
  }
})

router.get('/list', async (req, res, next) => {
  try {
    let descending = true
    if (req.query.descending != null) descending = JSON.parse(req.query.descending)

    let rowsPerPage = 10
    if (req.query.rowsPerPage != null) rowsPerPage = parseInt(req.query.rowsPerPage)

    let page = 1
    if (req.query.page != null) page = parseInt(req.query.page)

    const options = {
      user_id: req.user.id,
      page,
      rowsPerPage,
      sortBy: req.query.sortBy || 'id',
      descending,
      filter: req.query.filter,
    }
    // debug('page:', req.query.page, 'rowsPerPage', options.rowsPerPage)
    let result
    if (req.query.type == 'joined') {
      result = await chatRoomService.getJoinedRooms(options)
    } else {
      result = await chatRoomService.getPublicRooms(options)
    }
    const { chat_rooms, count } = result
    res.json({
      chat_rooms,
      count,
      page: options.page,
      rowsPerPage: options.rowsPerPage,
      sortBy: options.sortBy,
      descending: options.descending,
    })
  } catch (err) {
    debug('Error in /list: ', err.message)
    next(err)
  }
})

router.get('/my_joined', async (req, res, next) => {
  try {
    let descending = true
    if (req.query.descending != null) descending = JSON.parse(req.query.descending)

    let rowsPerPage = 10
    if (req.query.rowsPerPage != null) rowsPerPage = parseInt(req.query.rowsPerPage)

    let page = 1
    if (req.query.page != null) page = parseInt(req.query.page)

    const options = {
      user_id: req.user.id,
      page,
      rowsPerPage,
      sortBy: req.query.sortBy || 'id',
      descending,
      filter: req.query.filter,
    }
    debug('page:', req.query.page, 'rowsPerPage', options.rowsPerPage)
    const { chats, count } = await chatRoomService.getMyJoinedList(options)
    res.json({
      chats,
      count,
      page: options.page,
      rowsPerPage: options.rowsPerPage,
      sortBy: options.sortBy,
      descending: options.descending,
    })
  } catch (err) {
    debug('Error in /my_joined: ', err.message)
    next(err)
  }
})

// Create
router.post('/', async (req, res, next) => {
  try {
    const chat = await chatRoomService.create(req.user.id, req.body.name)
    res.json({ chat })
  } catch (err) {
    debug('Error in create: ', err.message)
    next(err)
  }
})

router.put('/', async (req, res, next) => {
  try {
    const result = await chatRoomService.update(req.body.chat_room_id, req.body.key, req.body.value)
    res.json({ num_updated: result })
  } catch (err) {
    debug(`update error ${err.message}`)
    next(err, req, res, next)
  }
})

router.delete('/', async (req, res, next) => {
  try {
    const result = await chatRoomService.delete(req.user.id, req.body.chat_room_id)
    res.json(result)
  } catch (err) {
    debug(`delete error ${err.message}`)
    next(err, req, res, next)
  }
})

router.delete('/member', async (req, res, next) => {
  try {
    const result = await chatRoomService.deleteMember(req.user.id, req.body.chat_room_id, req.body.member_user_id)
    res.json(result)
  } catch (err) {
    debug(`delete error ${err.message}`)
    next(err, req, res, next)
  }
})

router.delete('/invitee', async (req, res, next) => {
  try {
    const result = await chatRoomService.deleteInvitee(req.user.id, req.body.chat_room_id, req.body.invitee_id)
    res.json(result)
  } catch (err) {
    debug(`delete error ${err.message}`)
    next(err, req, res, next)
  }
})

router.post('/invite', auth.getLang, auth.authUser, async (req, res, next) => {
  try {
    const result = await chatRoomService.inviteUser(req.user.id, req.user.nickname, req.lang, req.body.chat_room_id, req.body.invitee_email_address)
    res.json(result)
  } catch (err) {
    debug(`invite error ${err.message}`)
    next(err, req, res, next)
  }
})

router.post('/join', auth.authUser, async (req, res, next) => {
  try {
    const result = await chatRoomService.joinUser(req.user.id, req.body.chat_room_id, req.body.password)
    res.json(result)
  } catch (err) {
    debug(`join error ${err.message}`)
    next(err, req, res, next)
  }
})
