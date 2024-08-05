/**
 * Created by jaekwon on 2017. 5. 11..
 */
import Debug from 'debug'
const debug = Debug('ankichampion:util:mailutil')
import Libmime from 'libmime'

function isValidEmail(email) {
	const emailPattern = /^(?=[a-zA-Z0-9@._%+-]{6,254}$)[a-zA-Z0-9._%+-]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.){1,8}[a-zA-Z]{2,63}$/
	return emailPattern.test(email)
}

import { SendEmailCommand, SESClient, CloneReceiptRuleSetCommand } from "@aws-sdk/client-ses"

// debug('AWS_SES_KEY_ID', process.env.AWS_SES_KEY_ID)
// debug('AWS_SES_ACCESS_KEY', process.env.AWS_SES_ACCESS_KEY)

const sesClient = new SESClient({
	region: "ap-northeast-2",
	credentials: {
		accessKeyId: process.env.AWS_SES_KEY_ID,
		secretAccessKey: process.env.AWS_SES_ACCESS_KEY
	}
})

// 계정이 막히면, 아래 주소에 접속해서 풀어야 함
//  https://accounts.google.com/DisplayUnlockCaptcha
// import nodemailer from 'nodemailer'


// let smtpTransport = nodemailer.createTransport({
// 	SES: { ses, aws }
// })

// debug("email", auth.email)

// function sendMail(options) {
// 	return new Promise((resolve, reject) => {
// 		smtpTransport.sendMail(options, (err, result) => {
// 			if (err) {
// 				console.error('mail error', err)
// 				return reject(err)
// 			}
// 			debug('mail sent')
// 			return resolve(result)
// 		})
// 	})
// }

/*
sendMail({
		from: 'no-reply-login@codingpen.com',
		to: 'jjk@beyondapp.com',
		subject: 'Node.js에서 발송한 메일',
		html: '<h1>이메일이에요!</h1>'
}, (err, info) => {
	if (err) {
			error(err);
	}
	console.log('sendEmail: '+ JSON.stringify(info.envelope));
	console.log(info.messageId);
});
*/

// https://myaccount.google.com/lesssecureapps 에서 인증 풀기
//  https://accounts.google.com/DisplayUnlockCaptcha
let from = 'noreply.automata@gmail.com'
const mailService = {
	sendMail: async function (toAddress, subject, text, html, name = '챗토마타', fromAddress = from) {
		debug('sending mail to ' + toAddress)
		if (isValidEmail(toAddress) == false) throw new Error('invalid email: ' + toAddress)

		let encoded_name = Libmime.encodeWord(name, 'Q')
		fromAddress = `${encoded_name}<${fromAddress}>`
		// const fromAddress = punycode.toASCII('')
		// if (attachments != null && attachments.length > 0) options.attachments = attachments
		try {
			let result = await sesClient.send(new SendEmailCommand({
				Destination: {
					CcAddresses: [],
					ToAddresses: [
						toAddress,
					],
				},
				Message: {
					Body: {
						Html: {
							Charset: "UTF-8",
							Data: html || text
						},
						Text: {
							Charset: "UTF-8",
							Data: text || html
						},
					},
					Subject: {
						Charset: "UTF-8",
						Data: subject,
					},
				},
				Source: fromAddress,
				ReplyToAddresses: [],
			}))
			debug(`sent mail to ${toAddress}`, result)
			return true
		} catch (e) {
			debug('sendMail error', e.message)
			return false
		}
	}
}
	
export default mailService

// mailService.sendMail('librorum@naver.com', '테스트 메일', '테스트 메일입니다.', '테스트 메일입니다.').then((r) => {
// 	console.log('sent', r)
// })