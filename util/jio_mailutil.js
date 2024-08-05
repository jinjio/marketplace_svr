import Debug from 'debug'
const debug = Debug('egm_server:util:mailutil')

// const aws = require('aws-sdk')
import aws from 'aws-sdk'
aws.config.update({
	accessKeyId: process.env.AWS_SES_KEY_ID,
	secretAccessKey: process.env.AWS_SES_ACCESS_KEY,
	region: 'ap-northeast-2',
})

import nodemailer from 'nodemailer'
// let nodemailer = require('nodemailer')
// let smtpTransport = nodemailer.createTransport({	
// 	service: 'gmail',
// 	// host: 'smtp.gmail.com',
// 	// port: 587, 
// 	// secure: false,
// 	auth: {
// 		user: 'no-reply-login@egm.com',
// 		pass: 'iebyjfrqkokvmqzr',
// 	},
// 	debug: true,
// })

let smtpTransport = nodemailer.createTransport({
	SES: new aws.SES({
		apiVersion: '2010-12-01'
	})
})



function sendMail(options) {
	return new Promise((resolve, reject) => {
		smtpTransport.sendMail(options, (err, result) => {
			if (err) {
				console.error('mail error', err)
				return reject(err)
			}
			debug('mail sent')
			return resolve(result)
		})
	})
}

function isValidEmail (email) {
	const emailPattern = /^(?=[a-zA-Z0-9@._%+-]{6,254}$)[a-zA-Z0-9._%+-]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.){1,8}[a-zA-Z]{2,63}$/
	return emailPattern.test(email)
}
const mailService = {

    sendMail: async (toEmailAddress, subject, text, html, attachments) => {
        try {
            debug('sending mail to ' + toEmailAddress)
            if (isValidEmail(toEmailAddress) == false) throw new Error('invalid email: ' + toEmailAddress)
            //  첨부파일 넣는 법
            let options = {
                from: '안키챔피언<no-reply-login@reviewral.com>',
                to: toEmailAddress,
                subject: subject,
            }
            if (text != null) options.text = text
        
            if (html != null) options.html = html
        
            if (attachments != null && attachments.length > 0) options.attachments = attachments
        
            await sendMail(options)
            debug(`sent mail to ${toEmailAddress}`)
            return true    
        } catch (e) {
            return false
        }
    }
    
}

export default mailService