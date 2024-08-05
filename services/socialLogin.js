import Debug from 'debug'
const debug = Debug('ankichampion:service:socialLogin')
import assert from 'assert'

import express from 'express'
// import request from 'request-promise-native'
import jwt from 'jsonwebtoken'

function validateEmail(email) {
	const regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
	return regex.test(String(email).toLowerCase())
}

export default {
	getUser: async function (accessToken, type, origin, host) {
		if (type == 'facebook') return this.getFacebookUser(accessToken)
		else if (type == 'google') return this.getGoogleUser(accessToken, origin, host)
		else if (type == 'kakao') return this.getKakaoUser(accessToken, origin, host)
	},
	getFacebookUser: async function (accessToken) {
		if (!accessToken) return null

		const requestUserURL = `https://graph.facebook.com/v3.0/me?access_token=${accessToken}&fields=name,id,email,picture.width(1024).height(1024)`
		// const response = await request({ method: 'GET', uri: requestUserURL, json: true })
		const response = await fetch(requestUserURL)
		if (!response || !response.statusCode >= 400) {
			throw Error('invalid_facebook_user')
		}
		const data = await response.json()
		return {
			id: data.id,
			email: data.email || '',
			name: data.name,
			photo: data.picture.data.is_silhouette ? '' : data.picture.data.url,
		}
	},
	// 설정하는 곳
	// https://console.cloud.google.com/apis/credentials/oauthclient/1017353774615-9jq1jmrvp07glgui60qd5slv4cd73n9t.apps.googleusercontent.com?project=hanform-26726
	getGoogleUser: async function (accessToken, origin, host) {
		if (!accessToken) return null
		let redirect_uri = `${origin}/user/oauth/google/${host}`
		debug('getGoogleUser accessToken', accessToken)
		debug('              redirect_uri', redirect_uri)
		try {
			//accessToken = accessToken + 'a'
			const requestUserURL = `https://www.googleapis.com/oauth2/v4/token`
			// const response = await request({
			// 	method: 'POST',
			// 	uri: requestUserURL,
			// 	body: {
			// 		client_id: '1017353774615-9jq1jmrvp07glgui60qd5slv4cd73n9t.apps.googleusercontent.com',
			// 		client_secret: 'B8Vq2nf_jxwxDRreaHLlXbuG',
			// 		grant_type: 'authorization_code',
			// 		code: accessToken,
			// 		redirect_uri: redirect_uri,
			// 	},
			// 	json: true,
			// })

			const response = await fetch(requestUserURL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					// client_id: '822221063607-mfg6cjqo1v3n8qiq32r4vvu7hnhgru21.apps.googleusercontent.com',
					// client_secret: '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',
					client_id: '13088297217-nv5ntslqd7ah82tjq5vmtdga6b44g95b.apps.googleusercontent.com',
					client_secret: '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',
					grant_type: 'authorization_code',
					code: accessToken,
					redirect_uri: redirect_uri,
				})
			})

			if (!response || !response.status >= 400) {
				throw Error(response.statusText)
			}
			const data = await response.json()
			// 여기서 받은 토큰을 가지고 이메일을 다시 가지고 와야 함.
			assert(data.id_token != null, 'id_token not found')
			let decoded = jwt.decode(data.id_token)
			debug('decoded', decoded)
			return {
				id: decoded.sub,
				email: decoded.email || '',
				name: decoded.name,
				photo: decoded.picture,
			}
		} catch (e) {
			debug('error:' + e.message)
			debug('satck:' + e.stack)
			throw Error(e.message)
		}
	},
	getKakaoUser: async function (code, origin, host) {
		// 카톡의 경우 임시토콘 받을 때 redirect_uri와 억세스토큰 받을 때 redirect_uri가 다르면
		// redirect_mismatch 오류가 나기 때문에 origin 받아서 처리
		let redirect_uri = `${origin}/oauth/kakao/${host}`
		debug('getKakaoUser')
		debug('code', code)
		debug('host', host)
		debug('origin: ' + origin)
		debug('redirect_uri', redirect_uri)
		const requestTokenURL = 'https://kauth.kakao.com/oauth/token'
		const client_id = 'fc19e1bd47d195f997dd8f891c0914f8'
		const body = {
			grant_type: 'authorization_code',
			client_id: client_id,
			redirect_uri: redirect_uri,
			code: code,
		}
		let start = new Date().getTime()
		const tokenResponse = await request({ method: 'POST', uri: requestTokenURL, form: body, json: true })
		if (!tokenResponse || !tokenResponse.statusCode >= 400) {
			debug('카카오 코드 인증 실패')
			throw Error('카카오 코드 인증 실패')
		}
		debug('elapsed: ' + new Date().getTime() - start)
		let kakaoAccessToken = tokenResponse.access_token

		const requestUserURL = 'https://kapi.kakao.com/v2/user/me'
		const headers = { Authorization: `Bearer ${kakaoAccessToken}` }
		// const userResponse = await request({ method: 'GET', uri: requestUserURL, headers, json: true })

		const response = await fetch(requestUserURL, {
			headers: headers
		})

		if (!response || !response.statusCode >= 400) {
			throw Error('잘못된 카카오 유저입니다.')
		}
		const data = await response.json()

		// profile_image : 640x640
		// thumbnail_image : 110x110
		return {
			id: data.id,
			email: data.kakao_account.email,
			gender: data.kakao_account.gender,
			age_range: data.kakao_account.age_range,
			photo: data.properties.profile_image,
			name: data.properties.nickname,
			nickname: data.kakao_account.profile.nickname,
		}
	},
}
