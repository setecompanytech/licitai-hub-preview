/**
 * Stripe product/price mapping for each plan × billing cycle.
 * Prices created with real discounts applied:
 *   Trimestral = 10% OFF, Semestral = 15% OFF, Anual = 20% OFF
 */

import type { BillingCycle } from './pricing-config';

export const stripePlans = {
  basico: {
    product_id: 'prod_UFHAhv2lqyHXyT',
    prices: {
      mensal:     'price_1TGmcKE3AM5xbN4IapcDrrG8',   // R$ 197,00/mês
      trimestral: 'price_1TGmeOE3AM5xbN4In5NWouOF',    // R$ 531,90/tri  (R$ 177,30/mês)
      semestral:  'price_1TGmeOE3AM5xbN4IVkY8VLTG',    // R$ 1.004,70/sem (R$ 167,45/mês)
      anual:      'price_1TGmeOE3AM5xbN4Ighm4fVzH',    // R$ 1.891,20/ano (R$ 157,60/mês)
    } satisfies Record<BillingCycle, string>,
  },
  profissional: {
    product_id: 'prod_UFHBRsquFdT751',
    prices: {
      mensal:     'price_1TGmclE3AM5xbN4IhSdCKm2G',   // R$ 497,00/mês
      trimestral: 'price_1TGmeOE3AM5xbN4IHlnkV9EA',    // R$ 1.341,90/tri  (R$ 447,30/mês)
      semestral:  'price_1TGmePE3AM5xbN4IQChyVyak',    // R$ 2.534,70/sem (R$ 422,45/mês)
      anual:      'price_1TGmePE3AM5xbN4IhvLxpnk9',    // R$ 4.771,20/ano (R$ 397,60/mês)
    } satisfies Record<BillingCycle, string>,
  },
  enterprise: {
    product_id: 'prod_UFHBGUZhicRt8q',
    prices: {
      mensal:     'price_1TGmdCE3AM5xbN4IkjE7Jq3M',   // R$ 997,00/mês
      trimestral: 'price_1TGmePE3AM5xbN4IiQy93JWl',    // R$ 2.691,90/tri  (R$ 897,30/mês)
      semestral:  'price_1TGmeQE3AM5xbN4I4dZ359Do',    // R$ 5.084,70/sem (R$ 847,45/mês)
      anual:      'price_1TGmeQE3AM5xbN4IwHCKsPnJ',    // R$ 9.571,20/ano (R$ 797,60/mês)
    } satisfies Record<BillingCycle, string>,
  },
} as const;

export type StripePlanSlug = keyof typeof stripePlans;
