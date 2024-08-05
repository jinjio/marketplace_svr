import Debug from 'debug'
const debug = Debug('ankichampion:services:payment')
import assert from 'assert'
import Stripe from 'stripe'

import { knex } from '../util/knexutil.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const paymentService = {
  createPaymentIntent: async ({ amount, currency, user_id }) => {
    assert(amount > 0, 'Invalid amount')
    assert(currency, 'Currency is required')
    assert(user_id, 'User ID is required')

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: { user_id }
    })

    await knex('PaymentIntent').insert({
      id: paymentIntent.id,
      user_id,
      amount,
      currency,
      status: paymentIntent.status
    })

    return { clientSecret: paymentIntent.client_secret }
  },

  confirmPayment: async ({ paymentIntentId, user_id }) => {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    assert(paymentIntent.metadata.user_id === user_id, 'Unauthorized')

    if (paymentIntent.status === 'succeeded') {
      await knex('PaymentIntent')
        .where('id', paymentIntentId)
        .update({ status: 'succeeded' })

      // 여기에 결제 성공 후 비즈니스 로직 추가 (예: 사용자 크레딧 증가 등)

      return { success: true, message: 'Payment successful' }
    } else {
      return { success: false, message: 'Payment failed' }
    }
  },

  getPaymentHistory: async ({ user_id, page = 1, rowsPerPage = 10 }) => {
    const query = knex('PaymentIntent')
      .where('user_id', user_id)
      .orderBy('created_at', 'desc')

    const total = await query.clone().count('* as count').first()
    const payments = await query
      .limit(rowsPerPage)
      .offset((page - 1) * rowsPerPage)

    return {
      payments,
      total: total.count,
      page,
      rowsPerPage
    }
  }
}

export default paymentService