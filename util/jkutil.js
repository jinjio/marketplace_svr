import { nanoid } from 'nanoid'
import { knex } from './knexutil.js'
import randomstring from 'randomstring'

// import fetch from 'node-fetch'

export default {
	lastPathComponent: function lastPathComponent(path) {
		return path.substring(path.lastIndexOf('/') + 1)
	},

	variable_re: /\{{([^}]+)\}}/g,
	empty_block_re: /⟪([^⟫]*)⟫/g,
	empty_select_re: /⟦([^⟧]*)⟧/g,

	pathExtension: function pathExtension(path) {
		return path.substring(path.lastIndexOf('.') + 1)
	},

	isValidEmail: (email) => {
		const emailPattern = /^(?=[a-zA-Z0-9@._%+-]{6,254}$)[a-zA-Z0-9._%+-]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.){1,8}[a-zA-Z]{2,63}$/
		return emailPattern.test(email)
	},

	getUniqueId: () => {
		return nanoid()
	},

	getUniqueNickName: async (email) => {
		let nickname = email.split('@')[0]
		let try_count = 0
		while (true) {
			if (try_count > 10) {
				// 닉네임 생성에 실패하면 에러 처리, 이럴 일이 없을 것 같지만, 
				throw new Error('nickname_create_failed')
			}
			let existing_nickname = await knex('User').where('nickname', nickname).where('deleted', false).first()
			if (existing_nickname == null) {
				break
			}
			nickname += randomstring.generate({ length: 1, charset: 'numeric' })
			try_count++
		}
		return nickname
	},

	arrRemove: (arr, elem) => {
		if (arr == null || elem == null) return null
		let index = arr.indexOf(elem)
		if (index > -1) arr.splice(index, 1)
		return index
	},

	// Key, Value에서 Value가 null인 경우를 빼준다.
	removeEmptyKey: (obj) => {
		for (var propName in obj) {
			if (obj[propName] === null || obj[propName] === undefined || obj[propName].length == 0) {
				delete obj[propName]
			}
		}
		return obj
	},

	timeToSeconds: (time) => {
		if (time == null) return 0
		let arrTime = time.split(':').map((item) => parseInt(item))
		let seconds = 0
		for (let elem of arrTime) {
			seconds = seconds * 60 + elem
		}
		seconds *= 1000
		return seconds
	},

	secondsToHHMMSS: (seconds) => {
		return new Date(seconds * 1000).toISOString().substring(11, 8)
	},

	shuffleArray: (arr) => {
		// arr = arr.concat()
		// arr.sort(() => 0.5 - Math.random())
		// Fisher-Yates Algorithm
		for (var i = arr.length - 1;i > 0;i--) {
			var j = Math.floor(Math.random() * (i + 1)); //random index
			[arr[i], arr[j]] = [arr[j], arr[i]] // swap
		}
		return arr
	},

	numLinesOfString: (str) => {
		if (typeof str != 'string')
			str = String(str)
		return (str.match(/\n/g) || []).length + 1
	},

	isEmpty(value) {
		if (value == null) return true
		// array or string
		if (Array.isArray(value) || typeof value === 'string') {
			return value.length === 0
		}
		// object
		if (typeof value === 'object') {
			return Object.keys(value).length === 0
		}
		return false
	},

	translate: async (text, src_language = 'KO', target_language = 'EN') => {
		try {
			const response = await fetch('https://deepl-translator.p.rapidapi.com/translate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-RapidAPI-Key': 'er8baJLrGYmshLwcNt9WwDLYFOTop1CVSaIjsnpFiHFdRWERJQ',
					'X-RapidAPI-Host': 'deepl-translator.p.rapidapi.com'
				},
				body: JSON.stringify({
					text: text,
					source: src_language,
					target: target_language
				})
			})

			const data = await response.json()
			return data.text
		} catch (e) {
			console.error('translate', e.message)
		} finally {
		}
	},

}



