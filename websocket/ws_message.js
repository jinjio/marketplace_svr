import Debug from 'debug'
const debug = Debug('ankichampion:ws_message')
import assert from 'assert'

import { knex } from '../util/knexutil.js'
import { nanoid, customAlphabet } from 'nanoid'

import jkutil from '../util/jkutil.js'
import config from '../util/config.js'

export default {
	onMessageJSON: async (user, json, server) => {
		try {
			debug('-->recvCommand', json.command)
			if (json.command == 'lobby') {
				await server.lobby.joinUser({ user })
				let rooms = server.rooms.map(room => {
					return {
						room_id: room.id,
						section: room.section,
						name: room.name + room.section,
						num_connected_users: room.getNumAllUsers(),
					}
				})
				user.sendCommand('lobby', {
					room_count: server.getRoomCount(),
					lobby_num_connected_users: server.lobby.getNumAllUsers(),
					// lobby_users : users,
					rooms
				})
			} else if (json.command == 'join') {
				let room_id = json.options.room_id
				let room_type = json.options.room_type || 'live_room'
				assert(room_type != null, 'no_room_type')
				if (room_type == 'live_room') {
					assert(room_id != null, 'no_room_id')
					console.time('getRoom.' + user.id)
					let room = await server.getRoom(room_id, true, json.options.test_block_id)
					if (room == null)
						throw new Error('no_live_room')
					console.timeEnd('getRoom.' + user.id)
					if (room.password?.length > 0 && room.password !== json.options.password && user.id != room.host_id) {
						user.sendCommand('password', {})
						return
					}
					console.time('joinUser.' + user.id)
					await room.joinUser({
						user,
						section_id: json.options.section_id,
						test_block_id: json.options.test_block_id,
						view_all_blocks: json.options.view_all_blocks || false,
					})
					console.timeEnd('joinUser.' + user.id)
				} else if (room_type == 'playground') {
					assert(room_id != null, 'no_room_id')
					let playground = await server.getPlayground(room_id)
					if (playground == null)
						throw new Error('no_playground')

					if (playground.password?.length > 0 && playground.password !== json.options.password && user.id != playground.host_id) {
						user.sendCommand('password', {})
						return
					}
					if (playground.visibility == 'private' && playground.host_id != user.id) {
						throw new Error('private_playground')
					}
					await playground.joinUser(user)
				} else if (room_type == 'typing_game') {
					let gameroom = await server.getGameRoom(room_id)
					if (gameroom == null)
						throw new Error('no_game_room')

					if (gameroom.password?.length > 0 && gameroom.password !== json.options.password && user.id != gameroom.host_id) {
						user.sendCommand('password', {})
						return
					}
					if (gameroom.visibility == 'private' && gameroom.host_id != user.id) {
						throw new Error('private_game_room')
					}
					await gameroom.joinUser(user)
				} else if (room_type == 'chat_room') {
					assert(room_id != null, 'no_room_id')
					let chat_room = await server.getChatRoom(room_id)
					if (chat_room == null)
						throw new Error('no_chat_room')

					if (chat_room.password?.length > 0 && chat_room.password !== json.options.password && user.id != chat_room.host_id) {
						user.sendCommand('password', {})
						return
					}
					if (chat_room.visibility == 'private' && chat_room.host_id != user.id) {
						throw new Error('private_chat_room')
					}
					await chat_room.joinUser(user)
				} else {
					throw new Error('unknown_room_type')
				}
			} else if (json.command == 'pong') {
				// debug("pong_received --->", user.nickname)
				user.last_pong_time = (new Date().getTime())
			} else if (json.command == 'chat') {
				user.room.broadcast('chat', {
					sender: user.nickname,
					text: json.options.text,
					avatar: user.photo,
					user_id: user.id,
				}, user, { is_me: true })
				if (user.room.type == 'live_room') {
					user.room.broadcastObserver('chat', {
						sender: user.nickname,
						text: json.options.text,
						avatar: user.photo,
						user_id: user.id,
					}, user, { is_me: true })
				}
				await knex('ChatMessage').insert({
					chat_room_id: user.room.id,
					text: json.options.text,
					user_id: user.id,
				})
			} else {
				debug('unknown command', json.command)
				throw new Error('unknown_command')
			}
			delete user.answering_block_id
		} catch (e) {
			debug(e.stack)
			user.answering = false
			delete user.answering_block_id
			user.sendCommand('error', { message: e.message, block_id: user.current_block_id })
		}
	},
}
