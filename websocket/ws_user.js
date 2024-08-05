import Debug from 'debug'
const debug = Debug('ankichampion:websocket:ws_user')

import { encode } from '@msgpack/msgpack'
import { VM, NodeVM } from 'vm2'

import jkutil from '../jkutil.js'
import i18Helper from '../i18Helper.js'
import * as mathjs from 'mathjs'

function createParser() {
	let parser = mathjs.parser()
	parser.set('randomInt', function (min, max) {
		min = min || 0
		max = max || 1
		return `${mathjs.randomInt(min, max + 1)}`
	})


	// TODO : mathjs 보안 위협 체크
	// 원래는 				
	// https://mathjs.org/examples/advanced/more_secure_eval.js.html 
	// 이 방법으로 막힌다고 하는데 실제로 안 막힘 그래서 일단 이렇게 무식하게 처리
	parser.set('import', function () {
		return 'undefined'
	})

	parser.set('createUnit', function () {
		return 'undefined'
	})

	parser.set('evaluate', function () {
		return 'undefined'
	})

	parser.set('parse', function () {
		return 'undefined'
	})

	parser.set('simplify', function () {
		return 'undefined'
	})

	parser.set('derivative', function () {
		return 'undefined'
	})
	return parser
}


// const re = /⟪([^⟫]*)⟫/g

export default class {
	constructor({ user_id, session, language, nickname, photo }) {
		this.id = user_id
		this.session = session
		this.language = language
		this.nickname = nickname
		this.photo = photo
		this.connect_at = new Date().getTime()
		this.block_index = -1
		this.answers = []
		this.answering_block_id = null
		this.last_message_time = new Date().getTime()
		this.last_pong_time = new Date().getTime()
		this.auth = null
		this.score = 0
		this.inspectors = []
		this.answered_blocks = []
		this.authorized = false
		// this.room = room
	}

	setSection(section_id) {
		if (jkutil.isEmpty(section_id))
			return
		this.section = this.room.sections.find(item => item.id == section_id)
		if (this.section == null) {
			this.section = this.room.sub_sections.find(item => item.id == section_id)
		}

		this.block_index = -1
		this.answers = []
		this.answering_block_id = null
	}
	isArenaPlaying() {
		return this.section == null
	}
	isFinished() {
		if (this.block_index == this.room.blocks.length)
			return true
		return false
	}
	getConnectionTime() {
		let elapsed = new Date().getTime() - this.connect_at
		return elapsed
		// new Date(elapsed).toISOString().substr(11, 8)
	}
	getPlayTime() {
		if (this.start_time == null) return null
		let elapsed = new Date().getTime() - this.start_time
		return elapsed
	}


	sendCommand(command, options) {
		let data = {
			command,
			options,
		}
		if (command != 'arena_update')
			debug('sendCommand-->', command, `(${this.nickname})`)

		const buffer = Buffer.from(JSON.stringify(data))
		this.session.send(buffer, { binary: true })

		// let encoded = encode(data)
		// const buffer = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength)
		// this.session.sendBytes(buffer)
	}
	getCurrentBlock() {
		return this.block
	}
	async getNextBlock() {
		if (this.block?.end_block == true) return null
		let next_block_index
		if (this.section != null) {
			next_block_index = this.block_index + 1
		} else {
			next_block_index = this.room.arena.block_index + 1
		}

		let block = await this.room.getBlock(this.section?.id, next_block_index)
		block = JSON.parse(JSON.stringify(block)) // Deep Copy
		if (this.section?.hide_test_case === true) {
			block.tests = null
		}
		if (block == null) {
			// 다음 섹션이 있을 경우 그리로 갈지 물어보는 블럭을 자동으로 삽입
			if (this.section != null) {
				let next_section = this.room.getNextSection(this.section)
				if (next_section == null)
					return null
				let options = [
					{
						text: next_section.name,
						value: next_section.id
					}
				]
				if (this.preview === true && next_section.preview == false)
					options = []
				block = {
					block_index: this.block_index,
					answers_type: 'link',
					options,
					title: `[ ${this.section.name} ] ${i18Helper.getTranslation('finished', this.language)}`,
				}
				return block
			} else {
				// Arena 시에는 마지막 블럭은 끝.
				this.room.arena.elapsed_time = ((new Date().getTime() - this.room.arena.start_time) / 1000)
				return null
			}
		}
		block = await this.processTemplate(block, next_block_index)
		// TODO 여기랑 위의 로직이 좀 이상함. 통일하도록
		if (this.section != null) {
			this.block_index = next_block_index
		} else {
			this.room.arena.block_index++
		}
		block.can_change_answer = this.section != null ? this.section.can_change_answer : false
		if (this.room.correct_answer_required === false) {
			block.can_change_answer = false
			block.re_executable = false
		}
		block.key = new Date().getTime()
		this.block = block
		if (this.room.arena != null)
			this.room.arena.current_block = block
		return block
	}

	async processTemplate(block, block_index) {
		block = JSON.parse(JSON.stringify(block)) // deep copy
		if (block.etc?.variable?.set_variable != null) {
			for (let variable of block.etc.variable.set_variable) {
				variable.value = variable.value.replace(jkutil.variable_re, (match) => {
					let variable_name = match.substring(2, match.length - 2).trim()
					return this.getVariable(variable_name, block.repeat?.index, block_index)
				})
				this.setVariable(variable.name, variable.value)
			}
		}
		if (block.title != null && block.title.length > 0) {
			block.title = block.title.replace(jkutil.variable_re, (match) => {
				let variable_name = match.substring(2, match.length - 2).trim()
				return this.getVariable(variable_name, block.repeat?.index, block_index)
			})
		}
		if (block.title != null && block.title.length > 0) {
			block.title = block.title.replace(jkutil.variable_re, (match) => {
				let variable_name = match.substring(2, match.length - 2).trim()
				return this.getVariable(variable_name, block.repeat?.index, block_index)
			})
		}

		if (block.tts != null) {
			block.tts.text = block.tts.text.replace(jkutil.variable_re, (match) => {
				let variable_name = match.substring(2, match.length - 2).trim()
				return this.getVariable(variable_name, block.repeat?.index, block_index)
			})
		}
		if (block.options != null) {
			for (let option of block.options) {
				option.text = option.text.replace(jkutil.variable_re, (match) => {
					let variable_name = match.substring(2, match.length - 2).trim()
					return this.getVariable(variable_name, block.repeat?.index, block_index)
				})
			}
		}
		if (block.code != null && block.code.length > 0) {
			block.code = block.code.replace(jkutil.variable_re, (match) => {
				let variable_name = match.substring(2, match.length - 2).trim()
				return this.getVariable(variable_name, block.repeat?.index, block_index)
			})
		}
		let changed = false
		let correct_answers = await this.room.getAnswer(block.id)
		if (correct_answers != null) {
			let answersStr = JSON.stringify(correct_answers)
			answersStr = answersStr.replace(jkutil.variable_re, (match) => {
				changed = true
				let variable_name = match.substring(2, match.length - 2).trim()
				return this.getVariable(variable_name, block.repeat?.index, block_index)
			})
			if (changed) {
				// TODO 아래 정리해야함. 순서가 prepareBlock하고 processTemplate하고 조정할 필요가 있음.				
				if (block.answers_type == 'connect_pairs') {
					block.keys = block.keys.map(item => item.replace(jkutil.variable_re, (match) => {
						let variable_name = match.substring(2, match.length - 2).trim()
						return this.getVariable(variable_name, block.repeat?.index, block_index)
					}))
					block.values = block.values.map(item => item.replace(jkutil.variable_re, (match) => {
						let variable_name = match.substring(2, match.length - 2).trim()
						return this.getVariable(variable_name, block.repeat?.index, block_index)
					}))
				}
				else if (block.answers_type == 'sequence_quiz') {
					let answer = this.room.answers[block.id]
					if (jkutil.variable_re.test(answer)) {
						let answerProcessed = answer.replace(jkutil.variable_re, (match) => {
							let variable_name = match.substring(2, match.length - 2).trim()
							return this.getVariable(variable_name, block.repeat?.index, block_index)
						})
						block.sequence = answerProcessed.split(/(\s+)/).filter(item => item.trim().length > 0)
						jkutil.shuffleArray(block.sequence)

						// block.spelling = answerProcessed.split('')
						// jkutil.shuffleArray(block.spelling)
					}
					answersStr = answersStr.split(' ').filter(item => item.trim().length > 0).join(' ')
					// let hasVariable = false
					// block.sequence = block.sequence.map(item => item.replace(jkutil.variable_re, (match) => {
					// 	let variable_name = match.substring(2, match.length-2).trim()
					// 	hasVariable = true
					// 	return this.getVariable(variable_name, block.repeat?.index, block_index)		
					// }))
					// if(hasVariable === true) {
					// 	block.sequence = block.sequence.map(item => item.split(/(\s+)/).filter(item => item.trim().length > 0))
					// 	block.sequence = block.sequence.flat()
					// 	jkutil.shuffleArray(block.sequence)	
					// }
				}
				else if (block.answers_type == 'spelling') {
					let answer = this.room.answers[block.id]
					if (jkutil.variable_re.test(answer)) {
						let answerProcessed = answer.replace(jkutil.variable_re, (match) => {
							let variable_name = match.substring(2, match.length - 2).trim()
							return this.getVariable(variable_name, block.repeat?.index, block_index)
						})
						block.spelling = answerProcessed.split('')
						jkutil.shuffleArray(block.spelling)
					}
				}
				this.room.setAnswer(block.id, JSON.parse(answersStr))
			}
		}
		return block
	}
	setVariable(key, value) {
		debug('setVariable', key, value)
		if (key == null || value == null)
			return

		if (this.parser == null)
			this.parser = createParser()

		this.parser.set(key, value)
	}

	// {{var_name}}, 0, 0 이렇게 인수가 옴
	getVariable(variable_name, row, block_index) {
		if (row == null)
			row = 0

		if (variable_name.indexOf('.') != -1) {
			let variable = variable_name.split('.')
			// data_name.key 이런 식으로 구성되어 있음.
			let data_name = variable[0]
			let search_index = /\[([^]+)\]/.exec(data_name)
			if (search_index != null) {
				data_name = data_name.replace(search_index[0], '')
				row = parseInt(search_index[1])
			}
			let data_key = variable[1]
			let data = this.room.datas[data_name]

			if (data != null) {
				let column_index = data.columns.findIndex(item => item == data_key)
				if (data != null) {
					let value = data.rows[row][column_index]
					value = value.replace('\\n', '<br>')
					return value
				}
			}
		}

		if (variable_name == 'index') {
			return `${block_index}`
		} else if (variable_name == 'no') {
			// 블럭 번호 변수 1부터 시작
			return `${block_index + 1}`
		} else {
			if (variable_name.length > 256)
				throw new Error('too_big_template')
			try {
				// 사용자별로 해야 각자 변수가 오버라이팅이 되지 않는다.
				if (this.parser == null)
					this.parser = createParser()
				this.parser.set('index', block_index)
				this.parser.set('no', block_index + 1)
				let result = this.parser.evaluate(variable_name)
				// let result = parser.evaluate(data_name, scope)
				debug('result', variable_name, typeof (result) == 'function')
				if (typeof (result) == 'function')
					return 'function_synatx_error'
				else if (typeof (result) == 'object')
					return null
				return result
			} catch (e) {
				debug('evaluate', e)
				// if(e.message.indexOf('Undefined symbol') != -1)
				// 	return e.message
				return e.message
			}
			// throw new Error(`data not found - ${data_name}, blocK_index: ${block_index}`)
			// debug(`data not found - ${data_name}`)	
		}
		return null
	}
	recordAnswer(block_id, answers, is_correct, score, correct_answers) {
		this.answers.push({
			block_id,
			answers,
			is_correct,
			score,
		})
		// 재실행을 위해서 아래에 저장
		this.previous_block_id = block_id
		if (correct_answers?.length == 0) {
			this.can_re_execute = true
		} else {
			this.can_re_execute = false
		}
		this.answering_block_id = null
	}
	getOldAnswer(block_id) {
		return this.answers.find(item => item.block_id == block_id)
	}
	getProgress() {
		return {
			block_index: this.block_index,
		}
	}

	runJavascript(code, use_node_vm) {
		if (this.console_log == null || (this.console_log?.length > 0))
			this.console_log = ''
		if (this.vm == null) {
			if (use_node_vm === true) {
				debug('creating NodeVM')
				this.vm = new NodeVM({
					timeout: 30000,
					sandbox: {
						console: {
							log: (val) => {
								this.console_log += `${val}\n`
							}
						},
					}
				})
			} else {
				debug('creating vm')
				this.vm = new VM({
					timeout: 30000,
				})
			}
		}

		if (use_node_vm === true) {
			this.vm.run(code)
			return this.console_log
		} else {
			return this.vm.run(code)
		}
	}
	clearVM() {
		this.vm = null
	}
}
