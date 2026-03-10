
-- Update plan prices with refined values based on cost analysis
-- Básico: R$197 → R$197 (mantém - cobre custo base por usuário)
-- Profissional: R$497 → R$497 (mantém - margem saudável)
-- Enterprise: R$997 → R$997 (mantém - valor premium)
-- No changes needed - prices are well-calibrated

-- Add trial_dias column for trial period tracking
ALTER TABLE planos ADD COLUMN IF NOT EXISTS trial_dias integer DEFAULT 7;

-- Update trial days
UPDATE planos SET trial_dias = 7 WHERE slug = 'basico';
UPDATE planos SET trial_dias = 14 WHERE slug = 'profissional';
UPDATE planos SET trial_dias = 14 WHERE slug = 'enterprise';
