/**
 * Stripe product/price mapping for each plan × billing cycle.
 * Prices created with real discounts applied:
 *   Trimestral = 10% OFF, Semestral = 15% OFF, Anual = 20% OFF
 */

import type { BillingCycle } from './pricing-config';

export const stripePlans = {
  basico: {
    product_id: 'prod_UFFzXlzGK8OfWy',
    prices: {
      mensal:     'price_1TGlTgE3AM5xbN4IOqDghZRR',   // R$ 197,00/mês
      trimestral: 'price_1TGlTfE3AM5xbN4IsjJNXqP4',    // R$ 531,90/tri  (R$ 177,30/mês)
      semestral:  'price_1TGlTfE3AM5xbN4IjB7HVar7',    // R$ 1.004,70/sem (R$ 167,45/mês)
      anual:      'price_1TGlTeE3AM5xbN4IWTDUHB5p',    // R$ 1.891,20/ano (R$ 157,60/mês)
    } satisfies Record<BillingCycle, string>,
  },
  profissional: {
    product_id: 'prod_UFFziPdCfP3rTw',
    prices: {
      mensal:     'price_1TGlTfE3AM5xbN4If9b2QXP0',   // R$ 497,00/mês
      trimestral: 'price_1TGlTfE3AM5xbN4IuzJtQfnL',    // R$ 1.341,90/tri  (R$ 447,30/mês)
      semestral:  'price_1TGlTeE3AM5xbN4IxYd9acJM',    // R$ 2.534,70/sem (R$ 422,45/mês)
      anual:      'price_1TGlTeE3AM5xbN4IEoxMikcz',    // R$ 4.771,20/ano (R$ 397,60/mês)
    } satisfies Record<BillingCycle, string>,
  },
  enterprise: {
    product_id: 'prod_UFFzoFGvapTwRU',
    prices: {
      mensal:     'price_1TGlTfE3AM5xbN4I0IddRlkp',   // R$ 997,00/mês
      trimestral: 'price_1TGlTfE3AM5xbN4IUIrRqjlX',    // R$ 2.691,90/tri  (R$ 897,30/mês)
      semestral:  'price_1TGlTeE3AM5xbN4IzvFzPC3M',    // R$ 5.084,70/sem (R$ 847,45/mês)
      anual:      'price_1TGlTdE3AM5xbN4Ih3dQWeBF',    // R$ 9.571,20/ano (R$ 797,60/mês)
    } satisfies Record<BillingCycle, string>,
  },
} as const;

export type StripePlanSlug = keyof typeof stripePlans;
