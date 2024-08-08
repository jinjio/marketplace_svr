import Debug from 'debug'
const debug = Debug('marketplace:routes:api_key')

import express from 'express'
const router = express.Router()
export default router

import apiKeyService from '../services/api_key.js'

import auth from '../services/auth.js'

router.use('/', auth.authUser)

// router.get('/', async (req, res, next) => {
//   try {
//     const result = await apiKeyService.get({
//       user_id: req.user.id,
//       chat_room_id: req.query.chat_room_id
//     })
//     res.json(result)
//   } catch (err) {
//     debug('Error in GET /', err.message)
//     next(err)
//   }
// })

// router.get('/list', async (req, res, next) => {
//   try {
//     let descending = true
//     if (req.query.descending != null) descending = JSON.parse(req.query.descending)

//     let rowsPerPage = 10
//     if (req.query.rowsPerPage != null) rowsPerPage = parseInt(req.query.rowsPerPage)

//     let page = 1
//     if (req.query.page != null) page = parseInt(req.query.page)

//     const options = {
//       user_id: req.user.id,
//       page,
//       rowsPerPage,
//       sortBy: req.query.sortBy || 'id',
//       descending,
//       filter: req.query.filter,
//     }
//     // debug('page:', req.query.page, 'rowsPerPage', options.rowsPerPage)
//     let result
//     if (req.query.type == 'joined') {
//       result = await apiKeyService.getJoinedRooms(options)
//     } else {
//       result = await apiKeyService.getPublicRooms(options)
//     }
//     const { chat_rooms, count } = result
//     res.json({
//       chat_rooms,
//       count,
//       page: options.page,
//       rowsPerPage: options.rowsPerPage,
//       sortBy: options.sortBy,
//       descending: options.descending,
//     })
//   } catch (err) {
//     debug('Error in /list: ', err.message)
//     next(err)
//   }
// })

// Create
router.post('/', async (req, res, next) => {
  try {
    const result = await apiKeyService.set(req.user.id, req.body.provider, req.body.api_key)
    res.json(result)
  } catch (err) {
    debug('Error in create: ', err.message)
    next(err)
  }
})

router.delete('/', async (req, res, next) => {
  try {
    const result = await apiKeyService.delete(req.body.id)
    res.json(result)
  } catch (err) {
    debug('Error in delete: ', err.message)
    next(err)
  }
})
