# NF-e de entrada → cadastro de produto → NF-e de saída

Regra de domínio fixada em 13/09/2026 pelo dono do produto. Este documento é
sobre o ASSUNTO, não sobre o código: ele diz o que é verdade fiscalmente, para
que a modelagem não precise ser redescoberta a cada tela.

---

## 1. Por que a entrada alimenta o cadastro

A nota fiscal de entrada registra a chegada de produto ou serviço ao
estabelecimento, formalizando **origem, quantidade e valor** do que foi
adquirido. É ela que sustenta o controle de estoque, o controle financeiro e a
escrituração — e é a ausência dela que produz inconsistência fiscal, multa,
autuação e **perda de crédito tributário**.

Daí a regra: **toda NF-e de entrada que chega ao sistema cadastra (ou atualiza)
o produto**. A rota `/produtos` é o destino desse cadastro; a aba Produtos de
Compras é a mesma sala, pela outra porta.

Situações em que a nota de entrada aparece, e que o sistema precisa suportar
sem tratar nenhuma como exceção esquisita:

- compra de produto ou serviço;
- devolução e troca de mercadoria;
- importação;
- retorno de industrialização;
- retorno de simples remessa (reparo, demonstração);
- transporte de mercadoria entre estados;
- **compra em leilão ou concorrência pública**;
- aquisição de MEI, pessoa física ou PJ não contribuinte do ICMS;
- transferência entre filiais.

Nos casos em que o fornecedor é dispensado de emitir (pessoa física, não
contribuinte do ICMS), **quem emite a nota de entrada é o próprio comprador**.
Ou seja: o sistema não pode assumir que toda entrada nasce de um XML recebido.

---

## 2. A finalidade da compra não é um detalhe

A mesma mercadoria entra por motivos diferentes, e o motivo muda o tratamento
fiscal e o destino no sistema:

| Finalidade | O que é | Para onde vai |
| --- | --- | --- |
| **Uso e consumo** | abastecimento interno — material de escritório, equipamento para a própria operação | despesa; não vira estoque de venda |
| **Revenda** | mercadoria que vai atender pedido de cliente | estoque disponível, com custo que forma o preço |
| **Imobilizado** | bem que fica no ativo | nem despesa direta nem estoque de venda |

Duas consequências que o código precisa respeitar:

1. **A finalidade é do ITEM DAQUELA ENTRADA, não do produto.** O mesmo item de
   catálogo pode entrar para consumo numa nota e para revenda em outra. Um
   padrão no cadastro do produto é conveniência; a verdade está na entrada.
2. **A finalidade afeta o direito a crédito** (uso e consumo, em regra, não
   gera crédito de ICMS; revenda, no regime normal, gera). Isto é regra
   tributária e depende do regime da empresa — o sistema registra o fato e
   **não decide sozinho** o crédito.

---

## 3. O que a saída herda da entrada, e o que não herda

Esta é a parte que mais custa quando se erra, porque o erro só aparece na
fiscalização.

### Herda — é do PRODUTO, permanente

| Dado | Regra |
| --- | --- |
| **NCM** (8 dígitos) | **exatamente o mesmo**; define a categoria fiscal da mercadoria |
| **CEST** | replicado quando o produto está sujeito a substituição tributária |
| **EAN / GTIN** | o código de barras não muda |
| **Descrição** | a base permanece |
| **Unidade de medida** | pode ser **adaptada**: comprou em caixa, vende em unidade |
| **Origem da mercadoria** | primeiro dígito do CST/CSOSN — nacional (0), importado direto (1), importado adquirido no mercado interno (2)… Vem da entrada e dita o primeiro dígito da saída |

### Herda — é da OPERAÇÃO, referência à nota de origem

| Dado | Quando |
| --- | --- |
| **Chave de acesso** (44 dígitos) da nota de origem | obrigatório em **devolução de compra** e **remessa**; vai no campo de NF-e referenciada (`RefNFe`) da saída |
| **DI / DSI** (declaração de importação) | quando se revende produto que a própria empresa importou; número e dados do desembaraço são referenciados na saída |

### Herda — é base de CÁLCULO, não valor copiado

| Dado | Para quê |
| --- | --- |
| **Custo de aquisição** (valor unitário da entrada) | base da margem e do preço de venda |
| **Impostos destacados** (ICMS, IPI, PIS, COFINS) | no regime normal (Presumido ou Real), são o **crédito** a escriturar, que abate o imposto da saída |

### NÃO herda — e copiar é erro

| Dado | Por quê |
| --- | --- |
| **CFOP** | entrada começa com 1 ou 2; saída, com 5 ou 6. Comprou com 1.102 → vende com 5.102. **Nunca são iguais** |
| **CST / CSOSN** (demais dígitos) | dependem da operação que VOCÊ faz e do SEU regime, não do fornecedor. Comprar de Simples e ser Lucro Real muda o código inteiro |
| **Alíquotas e valores de imposto** | calculados sobre o seu preço de venda e as regras do seu CNPJ |

---

## 4. O que isso exige da modelagem

Separar duas coisas que hoje se confundem:

- **Ficha do produto** — o que é permanente: NCM, CEST, EAN, origem da
  mercadoria, descrição base, unidade base. Muda raramente, e quando muda é
  correção de cadastro.
- **Item da entrada** — o que aconteceu naquela nota: CFOP de entrada,
  CST/CSOSN do fornecedor, quantidade, valor unitário, valor total, impostos
  destacados, finalidade, chave da nota, DI quando houver.

Guardar CFOP no produto seria o erro clássico: ele muda a cada operação, e
gravá-lo na ficha faz a saída herdar o código da entrada — exatamente o que a
tabela acima proíbe.

---

## 5. Vínculo com processo e cliente

Quando a compra existe para atender uma demanda específica, o item da entrada
se relaciona ao **processo** (a licitação/contrato) e, por ele, ao cliente que
será atendido. É o que fecha a cadeia que o sistema já persegue:

```
processo → contrato → item → pedido → NF-e de saída
                        ↑
        NF-e de entrada ┘   (a mercadoria que vai cumprir o pedido)
```

Compra para uso e consumo não tem esse vínculo, e **forçá-lo seria inventar
relação**: nem toda entrada existe por causa de um cliente.

---

## Fonte

Regra ditada pelo dono do produto em 13/09/2026, com a caracterização geral da
nota de entrada conferida em
`https://focusnfe.com.br/blog/o-que-e-nota-fiscal-entrada/`.
