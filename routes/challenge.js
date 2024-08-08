import Debug from 'debug'
const debug = Debug('marketplace:routes:challenge')

import express from 'express'
const router = express.Router()
export default router

import ChallengeService from '../services/challenge.js'
import auth from '../services/auth.js'


// router.use('/', auth.authUser)

router.get('/', async (req, res, next) => {
  try {
    const result = await ChallengeService.getChallenge(req.query.challenge_id, req.query.day_diff)
    console.log(result)
    res.json(result)
  } catch (err) {
    debug('Error in GET /', err.message)
    next(err)
  }
})

router.get('/list', async (req, res, next) => {
    try {
      const result = await ChallengeService.getChallengeList(req.query.chat_room_id)
      // console.log(result)
      res.json(result)
    } catch (err) {
      debug('Error in GET /list', err.message)
      next(err)
    }
  })

router.get('/user/list', async (req, res, next) => {
  try {
    const result = await ChallengeService.getUserList(req.query.challenge_id, req.query.day_diff)
    console.log(result)
    res.json(result)
  } catch (err) {
    debug('Error in GET /user/list', err.message)
    next(err)
  }
})

router.post('/create', async (req, res, next) => {
  try {
    const challenge = await ChallengeService.createChallenge(req.body.deck_name, req.body.challenge_name, req.body.daily_word, req.body.start_date, req.body.end_date)
    res.json(challenge)
  } catch (err) {
    debug(`post challenge error ${err.message}`)
    next(err, req, res, next)
  }
})

router.post('/mission',async (req, res, next) => {
  try {
    const challenge_mission = await ChallengeService.updateMission(req.body.challenge_id, req.body.user_id, req.body.mission_index, req.body.score)
    res.json(challenge_mission)
  } catch (err) {
    debug(`post user error ${err.message}`)
    next(err, req, res, next)
  }
})

router.get('/ranking', async (req, res, next) => {
  try {
    const result = await ChallengeService.getRanking(req.query.challenge_id)
    console.log(result)
    res.json(result)
  } catch (err) {
    debug('Error in GET /ranking', err.message)
    next(err)
  }
})