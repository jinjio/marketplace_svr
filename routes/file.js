import Debug from 'debug'
const debug = Debug('ankichampion:routes:file')
import assert from 'assert'
import express from 'express'
import fileUpload from 'express-fileupload'
import path, { basename } from 'path'
import auth from '../services/auth.js'
import fileService from '../services/file.js'
import XLSX from 'xlsx'
import fs from 'fs'
import awsutil from '../util/awsutil.js'
import aiService from '../services/ai.js'

const router = express.Router()


router.use('/', auth.authUser)


router.post('/upload_image', async function (req, res, next) {
	try {
		if (!req.files || Object.keys(req.files).length === 0) {
			debug('No files were uploaded.')
			return res.status(400).send('No files were uploaded.')
		}
		// assert(req.body.content_id != null, 'no_content_id')

		let urls = await fileService.uploadImage({
			user_id: req.user.id,
			content_id: req.body.content_id,
			content_type: req.body.content_type,
			files: req.files
		})
		res.send({
			urls,
		})
	} catch (err) {
		debug(`upload_image error ${err.message}`)
		next(err, req, res, next)
	}
})

router.post('/remove_image', async function (req, res, next) {
	try {
		await formService.remove_image(req.user.id, req.body.form_id, req.body.block_id, req.body.type, req.body.option_index, req.body.avatar_image)
		res.json({
			result: true
		})
	} catch (err) {
		debug(`removeImage error ${err.message}`)
		next(err, req, res, next)
	}
})

router.post('/upload', async function (req, res, next) {
	try {
		if (!req.files || Object.keys(req.files).length === 0) {
			return res.status(400).send({ message: 'No files were uploaded.' })
		}	
		const file = req.files.file
		let result = await fileService.uploadFile(file)
		console.log(result)
		res.json(result)
	} catch (err) {
		debug(`/upload error ${err.message}`)
		next(err, req, res, next)
	}
})

router.post('/extract_image', async function (req, res, next) {
	try {
		if (!req.files || Object.keys(req.files).length === 0) {
			debug('No files were uploaded.')
			return res.status(400).send('No files were uploaded.')
		}
		// assert(req.body.content_id != null, 'no_content_id')

		let result = await aiService.extractImage(req.files)
		res.send(result)
	} catch (err) {
		debug(`upload_image error ${err.message}`)
		next(err, req, res, next)
	}
})

  
// router.post('/textract_image', async function (req, res, next) {
// 	try {
// 		if (!req.files || Object.keys(req.files).length === 0) {
// 			debug('No files were uploaded.')
// 			return res.status(400).send('No files were uploaded.')
// 		}

// 		for (let file of Object.values(req.files)) {
// 			console.log(await awsutil.textract(file))
// 		}
// 		res.json('ok')
// 		// res.send({
// 		// 	urls,
// 		// })
// 	} catch (err) {
// 		debug(`upload_image error ${err.message}`)
// 		next(err, req, res, next)
// 	}
// })



export default router
