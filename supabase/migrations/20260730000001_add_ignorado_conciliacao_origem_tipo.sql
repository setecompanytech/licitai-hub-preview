-- Add "ignorado_conciliacao" to the financeiro_origem_tipo enum
-- Used when a bank movement is ignored in conciliation and a shadow lancamento is created
ALTER TYPE financeiro_origem_tipo ADD VALUE IF NOT EXISTS 'ignorado_conciliacao';
