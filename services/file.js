import Debug from 'debug'
const debug = Debug('ankichampion:service:file')
import assert from 'assert'

import { nanoid } from 'nanoid'
import fs from 'fs'
// import fileUpload from 'express-fileupload'
import path from 'path'
import XLSX from 'xlsx'
import jkutil from '../util/jkutil.js'
import awsutil from '../util/awsutil.js'

const fileService = {
	async uploadImage({ user_id, files, content_id, content_type = '' }) {

		let urls = []
		for (let file of Object.values(files)) {
			let location = ''
			if (content_type?.length > 0)
				location += `${content_type}/`
			if (content_id?.length > 0) {
				location += `${content_id}/`
			}
			location += `${nanoid()}.${jkutil.pathExtension(file.name)}`
			let url = await awsutil.uploadToS3(file, location, 600)
			urls.push(url)
		}
		return urls

		// let location = `${content_type}/${content_id}/${nanoid()}.${jkutil.pathExtension(file.name)}`
		// let url = await awsutil.uploadToS3(file, location, 600)
		// return url
	},

	async remove_image(user_id, content_id, block_id, type, option_index, avatar_image) {
		let block
		if (block_id != null) {
			block = await blockService.get(block_id, user_id)
			if (block == null) {
				return res.status(400).send(`Question ID ${block_id} not found`)
			}
		}
		let url
		if (type == 'option_image') {
			url = block.answers.options[option_index].image
		} else if (type == 'block_image') {
			url = block.image
		} else if (type == 'chat_story') {
			url = `${type}/${form_id}/${avatar_image}`
		} else {
			return res.status(400).send('No type was specified.')
		}
		if (url == null) {
			return res.status(400).send(`Image not exist`)
		}
		await awsutil.deleteS3(url)
		if (type == 'option_image') {
			block.answers.options[option_index].image = null
			// 아래 같이 안하면 갱신이 안됩니다.
			//let options = JSON.parse(JSON.stringify(block.options))
			await blockService.update(user_id, block_id, 'answers', JSON.stringify(jkutil.removeEmptyKey(block.answers)))
		} else if (type == 'block_image') {
			block.image = null
			await blockService.update(user_id, block_id, 'image', null)
		}
	},
	async uploadFile(file) {
		const filePath = path.resolve(`./data/raw_data/${file.name}`);
		fs.writeFileSync(filePath, file.data, { encoding: 'utf8' });

		
		let result

		file.mv(filePath, async (err) => {
			if (err) {
				debug(`upload error ${err.message}`)
			}			// 파일 삭제
			
			fs.unlinkSync(filePath)
			console.log('Received data:', result)
		})
		return result
	},
	// async textract() {

	// 	for (let file of Object.values(files)) {
	// 		let location = ''
	// 		if (content_type?.length > 0)
	// 			location += `${content_type}/`
	// 		if (content_id?.length > 0) {
	// 			location += `${content_id}/`
	// 		}
	// 		location += `${nanoid()}.${jkutil.pathExtension(file.name)}`
	// 		let url = await awsutil.textract(file, location, 600)
	// 		urls.push(url)
	// 	}
	// 	return urls

	// 	let location = `${content_type}/${content_id}/${nanoid()}.${jkutil.pathExtension(file.name)}`
	// 	let url = await awsutil.uploadToS3(file, location, 600)
	// 	return url	
	// }
}

export default fileService