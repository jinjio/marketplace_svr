import Debug from 'debug'
const debug = Debug('ankichampion:routes:payment')

import express from 'express'
const router = express.Router()
export default router

import paymentService from '../services/payment.js' 
import auth from '../services/auth.js'

router.use('/', auth.authUser)

// 결제 의도 생성
router.post('/create-payment-intent', async (req, res, next) => {
  try {
    const { amount, currency } = req.body
    const result = await paymentService.createPaymentIntent({
      amount,
      currency,
      user_id: req.user.id
    })
    res.json(result)
  } catch (err) {
    debug('Error in create-payment-intent', err.message)
    next(err)
  }
})

// 결제 확인
router.post('/confirm-payment', async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body
    const result = await paymentService.confirmPayment({
      paymentIntentId,
      user_id: req.user.id
    })
    res.json(result)
  } catch (err) {
    debug('Error in confirm-payment', err.message)
    next(err)
  }
})

// 결제 내역 조회
router.get('/history', async (req, res, next) => {
  try {
    const result = await paymentService.getPaymentHistory({
      user_id: req.user.id,
      page: req.query.page,
      rowsPerPage: req.query.rowsPerPage
    })
    res.json(result)
  } catch (err) {
    debug('Error in payment history', err.message)
    next(err)
  }
})