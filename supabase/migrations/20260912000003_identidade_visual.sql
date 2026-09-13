-- Identidade visual Praefectus (prancha oficial 12/09/2026): catálogo da
-- marca no banco, para PESQUISA (lupa geral, Ctrl+K) e ATALHOS (URLs fixas
-- dos arquivos em /marca/, cores para copiar, regras de aplicação).
--
-- Dado de REFERÊNCIA GLOBAL do produto — exceção consciente à regra
-- "toda tabela nova tem empresa_id": não é dado de tenant, é a marca do
-- próprio Praefectus, igual para todas as empresas. Leitura para qualquer
-- usuário autenticado; escrita só via service role (nenhuma policy de
-- INSERT/UPDATE/DELETE de propósito).

CREATE TABLE IF NOT EXISTS public.identidade_visual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('logo', 'cor', 'tipografia', 'regra')),
  nome text NOT NULL,
  descricao text,
  uso text,
  url text,             -- atalho: caminho servido pelo app (/marca/...) quando é arquivo
  valor text,           -- hex da cor, nome da fonte, texto da regra
  palavras_chave text[] NOT NULL DEFAULT '{}',
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.identidade_visual ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "identidade_visual_leitura" ON public.identidade_visual;
CREATE POLICY "identidade_visual_leitura" ON public.identidade_visual
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS identidade_visual_palavras_idx
  ON public.identidade_visual USING gin (palavras_chave);

INSERT INTO public.identidade_visual (slug, categoria, nome, descricao, uso, url, valor, palavras_chave) VALUES
  ('marca-principal', 'logo', 'Marca principal',
   'Símbolo (dois arcos e quadrado) + nome "praefectus" em minúsculas. Navy #102A43 no nome e arco superior; verde #087F5B no arco inferior e quadrado.',
   'Fundos claros: topbar do app, cabeçalho da landing, documentos, propostas, e-mails.',
   '/marca/marca-principal.svg', NULL,
   '{logo,logotipo,marca,praefectus,principal,horizontal,svg}'),
  ('marca-inversa', 'logo', 'Marca inversa',
   'Versão para fundo escuro: nome, arco superior e quadrado brancos; arco inferior verde #087F5B.',
   'Fundos escuros: rodapé navy, sidebar, splash, apresentações escuras.',
   '/marca/marca-inversa.svg', NULL,
   '{logo,logotipo,marca,praefectus,inversa,branca,negativa,fundo,escuro,svg}'),
  ('simbolo', 'logo', 'Símbolo isolado',
   'Só o símbolo, versão principal (navy + verde), sem o nome.',
   'Favicon, avatar, menu recolhido, espaços pequenos onde o nome não cabe.',
   '/marca/simbolo.svg', NULL,
   '{simbolo,icone,favicon,arcos,quadrado,avatar,svg}'),
  ('simbolo-inverso', 'logo', 'Símbolo inverso',
   'Só o símbolo, versão para fundo escuro (branco + verde).',
   'Ícone PWA, avatar sobre navy, marcas d''água em fundo escuro.',
   '/marca/simbolo-inverso.svg', NULL,
   '{simbolo,icone,inverso,branco,pwa,fundo,escuro,svg}'),
  ('cor-navy', 'cor', 'Navy estrutural', 'Azul principal da identidade.',
   'Nome e arco superior da marca, rodapé, sidebar, títulos.', NULL, '#102A43',
   '{cor,azul,navy,principal,estrutura,102a43}'),
  ('cor-verde', 'cor', 'Verde de ação', 'Verde das ações e do símbolo.',
   'Botões primários, links, CTAs, arco inferior e quadrado da marca.', NULL, '#087F5B',
   '{cor,verde,acao,botao,primaria,087f5b}'),
  ('cor-verde-hover', 'cor', 'Verde hover', 'Estado hover dos botões verdes.',
   'Hover de botões e links verdes.', NULL, '#066649',
   '{cor,verde,hover,066649}'),
  ('cor-fundo', 'cor', 'Fundo geral', 'Cinza-azulado do fundo das telas.',
   'Fundo geral do app e da landing.', NULL, '#F5F7FA',
   '{cor,fundo,background,cinza,f5f7fa}'),
  ('cor-texto-secundario', 'cor', 'Texto secundário', 'Cinza dos textos de apoio.',
   'Descrições, legendas, texto muted.', NULL, '#526477',
   '{cor,texto,secundario,cinza,muted,526477}'),
  ('cor-borda', 'cor', 'Borda', 'Cinza-claro das bordas e divisores.',
   'Bordas de cartões, campos e divisores.', NULL, '#DCE3EB',
   '{cor,borda,divisor,dce3eb}'),
  ('cor-erro', 'cor', 'Erro', 'Vermelho de erro e destrutivo.',
   'Mensagens de erro, ações destrutivas.', NULL, '#B42318',
   '{cor,erro,vermelho,destrutivo,b42318}'),
  ('cor-aviso', 'cor', 'Aviso', 'Âmbar de aviso.',
   'Alertas e estados de atenção.', NULL, '#92400E',
   '{cor,aviso,alerta,ambar,laranja,92400e}'),
  ('fonte-titulos', 'tipografia', 'Manrope', 'Fonte dos títulos (600/700/800) e da marca (800).',
   'h1–h6, botões de destaque, nome da marca.', NULL, 'Manrope',
   '{fonte,tipografia,titulo,manrope,heading}'),
  ('fonte-interface', 'tipografia', 'Inter', 'Fonte da interface e do corpo de texto.',
   'Todo o corpo, formulários, tabelas.', NULL, 'Inter',
   '{fonte,tipografia,corpo,interface,inter}'),
  ('regra-area-livre', 'regra', 'Área livre da marca',
   'Reservar ao redor da logo, no mínimo, o equivalente à largura do pequeno quadrado do símbolo.',
   'Qualquer aplicação da marca.', NULL,
   'Área livre mínima = largura do quadrado do símbolo.',
   '{regra,area,livre,respiro,margem,logo}'),
  ('regra-integridade', 'regra', 'Integridade da marca',
   'Nunca esticar, recortar, rotacionar ou aplicar sombras à logo. Altura sempre automática, proporção original.',
   'Qualquer aplicação da marca.', NULL,
   'Não esticar, não recortar, não sombrear; proporção sempre original.',
   '{regra,proporcao,esticar,recortar,sombra,logo}'),
  ('regra-versoes', 'regra', 'Versão por fundo',
   'Fundo claro usa a marca principal; fundo escuro usa a inversa (nome, arco superior e quadrado brancos; arco inferior verde).',
   'Escolha da versão em qualquer peça.', NULL,
   'Claro → principal · Escuro → inversa.',
   '{regra,versao,fundo,claro,escuro,inversa}')
ON CONFLICT (slug) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  uso = EXCLUDED.uso,
  url = EXCLUDED.url,
  valor = EXCLUDED.valor,
  palavras_chave = EXCLUDED.palavras_chave,
  atualizado_em = now();

NOTIFY pgrst, 'reload schema';
