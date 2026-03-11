/**
 * Stripe product/price mapping for each plan.
 * These IDs are from the live Stripe account.
 */
export const stripePlans = {
  basico: {
    product_id: 'prod_U8BLf0lgJdmPjo',
    price_id: 'price_1T9uz5Cxf8X5njD2iGt7HhOS',
  },
  profissional: {
    product_id: 'prod_U8BMIhvHd7qtNc',
    price_id: 'price_1T9uzcCxf8X5njD2YS8sMURY',
  },
  enterprise: {
    product_id: 'prod_U8BNTcx0HoshBz',
    price_id: 'price_1T9v0VCxf8X5njD2ycgjeaBv',
  },
} as const;

export type StripePlanSlug = keyof typeof stripePlans;
