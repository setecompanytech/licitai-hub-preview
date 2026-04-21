---
name: ATA SRP no módulo Gestão de Contratos
description: Suporte a Sistema de Registro de Preços (ATA SRP) usando a tabela contratos com tipo_documento, aditivos polimórficos e saldo automático
type: feature
---

A tabela `contratos` recebe a coluna `tipo_documento` ('contrato' | 'ata_srp') para diferenciar Contratos Administrativos de ATAs SRP. Campos adicionais para ATA: `numero_ata`, `validade_ata_meses`, `permite_carona`. Contratos podem opcionalmente referenciar a ATA de origem via `ata_srp_id` (FK auto-referencial).

Aditivos (`contrato_aditivos`) são polimórficos: a coluna `referencia_tipo` indica se o aditivo é de Contrato ou de ATA SRP — `contrato_id` aponta sempre para `contratos.id` (independentemente do tipo).

Saldo da ATA: cada `contrato_itens` pode referenciar um item de ATA via `ata_item_id`. O trigger `recalc_saldo_ata_item` recalcula automaticamente `quantidade_ata_consumida` e `saldo_quantitativo` no item da ATA quando contratos derivados são criados, alterados ou excluídos (ignora cancelados/rescindidos).

View `atas_srp_resumo` (security_invoker) consolida ATAs com `qtd_contratos_derivados`, `valor_consumido_total` e `qtd_itens`.

UI: módulo /gestao-contratos renomeado para "Gestão de Contratos e ATAs SRP". Formulário único alterna campos por tipo. Lista mostra badge "ATA SRP" e "Origem: ATA". Detalhe da ATA inclui aba "Contratos derivados".
