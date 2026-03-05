

## Plano: Centralização da Extração IA de Itens do Edital

### Problema Atual
A extração IA de itens do edital acontece em **3 pontos independentes**:
1. **Proposta Comercial** (`EditalUploader.tsx`) — extrai itens, órgão, prazos
2. **Robô de Lances** (`ConfigurarLanceDialog.tsx`) — extrai itens/lotes com valores de referência
3. **Precificação** — importa manualmente ou via catálogo

Cada módulo faz sua própria chamada à IA e os dados não são persistidos de forma estruturada. O mesmo edital pode ser processado 3 vezes.

### Solução

Criar uma tabela `licitacao_itens` que persiste os itens extraídos do edital, vinculados à `licitacao_id`. A extração ocorre **uma única vez** (ao "Iniciar Processo" ou na primeira análise) e todos os módulos consomem os mesmos dados.

### 1. Nova tabela `licitacao_itens`

```sql
CREATE TABLE public.licitacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacao_id uuid NOT NULL REFERENCES public.licitacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  numero integer NOT NULL DEFAULT 1,
  descricao text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1,
  unidade text NOT NULL DEFAULT 'UN',
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  lote text DEFAULT 'Único',
  marca text,
  fabricante text,
  modelo text,
  origem text DEFAULT 'manual', -- 'ia', 'manual', 'importado'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.licitacao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own licitacao_itens"
  ON public.licitacao_itens FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 2. Novo hook centralizado `useEditalExtraction`

Arquivo: `src/hooks/useEditalExtraction.ts`

Responsabilidades:
- **`extrairItensIA(licitacaoId, fileText)`** — chama a IA, parseia o JSON, persiste na tabela `licitacao_itens` e retorna os itens
- **`fetchItens(licitacaoId)`** — busca itens já extraídos da base
- **`saveItensManual(licitacaoId, itens)`** — salva itens editados manualmente
- **`deleteItem(itemId)`** / **`deleteLote(licitacaoId, lote)`** — remoção individual ou por lote

O hook verifica se já existem itens antes de chamar a IA, evitando duplicação.

### 3. Atualizar os consumidores

**a) `ConfigurarLanceDialog.tsx` (Robô de Lances)**
- No Step 0, ao importar do Kanban: chamar `fetchItens(licitacaoId)` em vez de buscar em `precificacao` e `catalogo_itens_precificados`
- Na extração IA: chamar `extrairItensIA()` do hook, que persiste e retorna
- Os itens retornados são mapeados para `DisputeItem[]` localmente

**b) `EditalUploader.tsx` (Proposta Comercial)**
- Após extração IA: persistir itens via `saveItensManual()` quando há `licitacaoId` disponível
- Se já existem itens persistidos, oferecer "Importar itens já extraídos" antes de re-extrair

**c) `useLicitacaoIntegration.ts` (Iniciar Processo)**
- Sem alteração no fluxo principal; os itens serão extraídos sob demanda na primeira vez que qualquer módulo precisar

### 4. Componente compartilhado `EditalItensTable`

Arquivo: `src/components/shared/EditalItensTable.tsx`

Tabela reutilizável que exibe os itens extraídos com:
- Edição inline de valores
- Remoção individual e por lote
- Badge de origem (IA / Manual / Importado)
- Alerta de inexequibilidade (>50%)

Usado tanto no Robô de Lances quanto na Proposta.

### 5. Fluxo final

```text
Monitoramento → "Iniciar Processo" → Kanban (licitacao criada)
                                          │
                                    1ª vez que qualquer módulo
                                    precisa dos itens:
                                          │
                                    Upload Edital → IA extrai
                                          │
                                    Persiste em licitacao_itens
                                          │
                            ┌─────────────┼─────────────┐
                            ▼             ▼             ▼
                      Precificação    Proposta    Robô de Lances
                      (consome)       (consome)     (consome)
```

### Arquivos a criar/modificar
- **Criar**: migration SQL para `licitacao_itens`
- **Criar**: `src/hooks/useEditalExtraction.ts`
- **Criar**: `src/components/shared/EditalItensTable.tsx`
- **Modificar**: `src/components/robo-lances/ConfigurarLanceDialog.tsx` — usar hook centralizado
- **Modificar**: `src/components/proposta/EditalUploader.tsx` — persistir e reutilizar itens
- **Modificar**: `src/hooks/useLicitacaoIntegration.ts` — sem mudanças estruturais (itens sob demanda)

