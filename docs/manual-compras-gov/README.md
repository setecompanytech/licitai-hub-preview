# Manuais oficiais do Compras.gov — material de mapeamento do robô

Guardados aqui em 16/09/2026 porque são a base para escrever a leitura da sala
de disputa, e porque as URLs do gov.br mudam de lugar: a primeira que tentei
(`…/manuais/manual-fase-externa/…`) respondeu **"Conteúdo Restrito"**, e a que
abriu foi outra, com `copy_of_manuais` no meio do caminho.

| Arquivo | Origem | O que serve |
| --- | --- | --- |
| `manual-pregao-eletronico-fornecedor.pdf` | http://www.comprasnet.gov.br/publicacoes/manuais/Manual_Pregao_Eletronico_Fornecedor.pdf | **o mais útil**: a seção "Para enviar Lances" descreve a tela do fornecedor campo a campo |
| `manual-sala-de-disputa-visao-governo.pdf` | https://www.gov.br/compras/pt-br/acesso-a-informacao/manuais/copy_of_manuais/manual-fase-externa/manual-sala-de-disputa-visao-governo/temporario-manual-sala-de-disputa_visao-governo-versao-1-0-1.pdf | a visão do pregoeiro; confirma fases, prorrogação e o encerramento aleatório |

Os `.txt` ao lado são o texto extraído com `pdftotext -layout`, para poder
pesquisar sem abrir o PDF:

```sh
grep -n -A12 "Para enviar Lances" docs/manual-compras-gov/manual-pregao-eletronico-fornecedor.txt
```

**A ressalva que importa:** os dois descrevem o Comprasnet anterior à
reformulação de 2021, e o que está no ar é o Compras.gov novo (`cnetmobile`,
Angular/PrimeNG). Os nomes dos campos tendem a sobreviver — o portal reaproveita
o vocabulário —, mas o que vale como prova é o que a gravação da sessão mostra
de dentro do portal. O que foi conferido ao vivo está em
[`../robo-de-lances.md`](../robo-de-lances.md), seção 4.2.

Peso: ~9,8 MB. Se um dia o repositório ficar pesado, os `.txt` (80 KB) bastam
para consulta — os PDFs são a cópia de segurança das figuras.
