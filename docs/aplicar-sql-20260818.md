# Aplicar as migrations pendentes — passo a passo no SQL Editor

Quatro migrations aguardam aplicação manual. As migrations **não rodam
sozinhas** neste projeto: o SQL é colado no SQL Editor do Supabase.

## Passo 0 — confirmar o projeto (obrigatório)

Antes de qualquer coisa, olhe a URL do navegador. Ela precisa conter:

```
uwtyuwktxalnpgrcbbgk
```

Se aparecer `pyizwczmmzavtujfbivd` ou outro id, **pare** — é o projeto errado.
Já houve SQL aplicado no projeto errado neste histórico; este passo existe por
causa disso.

## Passo 1 — ver o que ainda falta

Cole no SQL Editor e execute. O resultado diz quais já estão no banco:

```sql
select 'tipos de bonificação (20260817000001)' as migration,
       case when exists (
         select 1 from pg_constraint
          where conname = 'comissoes_config_tipo_comissao_check'
            and pg_get_constraintdef(oid) like '%percentual_nf_quitada%'
       ) then 'aplicada' else 'PENDENTE' end as status
union all
select 'vendedor só admin (20260818000001)',
       case when exists (
         select 1 from pg_trigger where tgname = 'trg_contratos_vendedor_somente_admin'
       ) then 'aplicada' else 'PENDENTE' end
union all
select 'meta sobre NF-e quitada (20260818000002)',
       case when exists (
         select 1 from pg_constraint
          where conname = 'comercial_metas_base_meta_check'
            and pg_get_constraintdef(oid) like '%nf_quitada%'
       ) then 'aplicada' else 'PENDENTE' end
union all
select 'marco de pagamento (20260818000003)',
       case when exists (
         select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'comissoes_config'
            and column_name = 'evento_pagamento'
       ) then 'aplicada' else 'PENDENTE' end;
```

Só cole as que aparecerem como **PENDENTE**. Todas são idempotentes — colar de
novo não quebra nada —, mas conferir antes evita susto.

## Atalho — um único bloco

Quem preferir uma colagem só: `docs/aplicar-20260818-bloco-unico.sql` traz as
quatro em um `BEGIN … COMMIT`, terminando pela conferência do Passo 1. É cópia
consolidada, **não** é migration — a fonte de verdade continua em
`supabase/migrations/`. Falhando qualquer parte, a transação inteira volta atrás
e nada fica pela metade.

## Passo 2 — colar, na ordem

Uma por vez: cole o arquivo inteiro, execute, confira o "Success", só então
passe para a próxima. O conteúdo está em `SQL_MIGRATIONS.md` (seções no fim) ou
nos arquivos abaixo.

| Ordem | Arquivo | O que muda na prática |
| --- | --- | --- |
| 1 | `supabase/migrations/20260817000001_bonificacao_tipos_faturamento_nf.sql` | Os tipos "% sobre faturamento" e "% sobre NF-e quitada" passam a salvar |
| 2 | `supabase/migrations/20260818000001_contratos_vendedor_somente_admin.sql` | Só administrador troca o vendedor do contrato |
| 3 | `supabase/migrations/20260818000002_metas_base_nf_quitada.sql` | "NF-e Quitada" passa a salvar como base de meta |
| 4 | `supabase/migrations/20260818000003_bonificacao_paga_so_apos_quitacao.sql` | Cada empresa escolhe quando a bonificação pode ser paga |

Sobre a nº 4: o arquivo foi **reescrito**. A primeira versão exigia quitação da
NF-e de todos; a atual lê a política de cada empresa. Se a versão antiga já foi
colada, cole a nova por cima — ela substitui a função.

## Passo 3 — conferir o efeito

Rode de novo o SQL do Passo 1: as quatro devem dizer "aplicada".

Depois, esta consulta mostra qual marco de pagamento cada colaborador herdou.
Nenhum comportamento muda sozinho — a herança reproduz o que já valia —, mas é
o momento de ajustar quem estiver no marco errado:

```sql
select cc.user_id,
       cc.tipo_comissao   as base_de_calculo,
       cc.evento_pagamento as quando_pode_pagar,
       cc.ativo
  from public.comissoes_config cc
 order by cc.ativo desc, cc.evento_pagamento;
```

A troca se faz pela tela (Equipe → Bonificação → Configurar → "Quando pagar"),
não por UPDATE manual.

## Passo 4 — o que pode travar depois

Lançamentos de bonificação criados **antes** desta regra não apontam qual
pedido comprova o marco. Eles não poderão ir para "pago" enquanto não forem
vinculados. Para ver se existe algum nessa situação:

```sql
select cl.id, cl.user_id, cl.valor_comissao, cl.status, cl.created_at
  from public.comissoes_lancamentos cl
 where cl.status <> 'pago'
   and cl.contrato_pedido_id is null
 order by cl.created_at;
```

Vazio significa nada a fazer. Com linhas, o caminho é relançar pela tela,
escolhendo o pedido correspondente — o lançamento antigo se cancela.

## Passo 5 — publicar

O SQL não vai ao ar sozinho: as telas que usam essas colunas estão no GitHub e
só chegam ao domínio pelo **Publish do Lovable**. Publique depois de aplicar o
SQL, nunca antes — tela nova contra banco velho gera erro de constraint na cara
do usuário.
