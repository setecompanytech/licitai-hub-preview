/**
 * Stripe product/price mapping for each plan × billing cycle.
 * Prices created with real discounts applied:
 *   Trimestral = 10% OFF, Semestral = 15% OFF, Anual = 20% OFF
 */

import type { BillingCycle } from './pricing-config';

export const stripePlans = {
  basico: {
    product_id: 'prod_U8BLf0lgJdmPjo',
    prices: {
      mensal:     'price_1T9uz5Cxf8X5njD2iGt7HhOS',   // R$ 197,00/mês
      trimestral: 'price_1TC7tzCxf8X5njD29OKzu8FB',    // R$ 531,90/tri  (R$ 177,30/mês)
      semestral:  'price_1TC7uLCxf8X5njD2qA4WPv8a',    // R$ 1.004,70/sem (R$ 167,45/mês)
      anual:      'price_1TC7vCCxf8X5njD2o9RGeLiu',    // R$ 1.891,20/ano (R$ 157,60/mês)
    } satisfies Record<BillingCycle, string>,
  },
  profissional: {
    product_id: 'prod_U8BMIhvHd7qtNc',
    prices: {
      mensal:     'price_1T9uzcCxf8X5njD2YS8sMURY',   // R$ 497,00/mês
      trimestral: 'price_1TC7w0Cxf8X5njD2fDZuKoL7',    // R$ 1.341,90/tri  (R$ 447,30/mês)
      semestral:  'price_1TC7wSCxf8X5njD2o7oCmOYh',    // R$ 2.534,70/sem (R$ 422,45/mês)
      anual:      'price_1TC7wsCxf8X5njD2idNbKQiW',    // R$ 4.771,20/ano (R$ 397,60/mês)
    } satisfies Record<BillingCycle, string>,
  },
  enterprise: {
    product_id: 'prod_U8BNTcx0HoshBz',
    prices: {
      mensal:     'price_1T9v0VCxf8X5njD2ycgjeaBv',   // R$ 997,00/mês
      trimestral: 'price_1TC7xkCxf8X5njD2tI69Ifz8',    // R$ 2.691,90/tri  (R$ 897,30/mês)
      semestral:  'price_1TC7yACxf8X5njD24H4lOItY',    // R$ 5.084,70/sem (R$ 847,45/mês)
      anual:      'price_1TC7yVCxf8X5njD2vwK9JXMT',    // R$ 9.571,20/ano (R$ 797,60/mês)
    } satisfies Record<BillingCycle, string>,
  },
} as const;

export type StripePlanSlug = keyof typeof stripePlans;
