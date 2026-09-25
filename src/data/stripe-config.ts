/**
 * Produtos do Stripe por plano — só como RESERVA para ler o plano de uma
 * assinatura antiga pelo `product_id`.
 *
 * Desde 25/09/2026 o preço a cobrar não vem daqui: `create-checkout` acha,
 * entre os preços ativos da conta Stripe, o do plano × ciclo pelo VALOR
 * (`supabase/functions/_shared/precos-stripe.ts`), e o plano de uma assinatura
 * vem do nome do produto (`check-subscription` devolve `plan_slug`). Os doze
 * ids `price_…` que viviam aqui (março, pelo Lovable) sumiram do Stripe e a
 * tela dizia "o plano não existe mais": id gravado à mão envelhece.
 */

export const stripePlans = {
  basico: { product_id: 'prod_UFFzXlzGK8OfWy' },
  profissional: { product_id: 'prod_UFFziPdCfP3rTw' },
  enterprise: { product_id: 'prod_UFFzoFGvapTwRU' },
} as const;

export type StripePlanSlug = keyof typeof stripePlans;
