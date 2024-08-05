import Debug from 'debug'
const debug = Debug('ankichampion:routes:util')
import express from 'express'
const router = express.Router()
import jkutil from '../util/jkutil.js'
import auth from '../services/auth.js'
import tranlationService from '../services/translation.js'
router.get('/translate_language_list', auth.authUser, async (req, res, next) => {
  let result = await tranlationService.getTranslateLanguageList()
  res.json(result)
})

export default router
