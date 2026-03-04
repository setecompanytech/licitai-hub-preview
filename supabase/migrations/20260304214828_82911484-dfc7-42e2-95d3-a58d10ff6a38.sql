
-- Sources table (marketplace/distributor registry)
CREATE TABLE public.search_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'marketplace',
  url_base text NOT NULL,
  metodo_ingestao text NOT NULL DEFAULT 'manual_link',
  campos_suportados jsonb DEFAULT '[]'::jsonb,
  categoria text DEFAULT 'generalista',
  ativo boolean NOT NULL DEFAULT true,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.search_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view sources" ON public.search_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage sources" ON public.search_sources FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Suppliers table
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  uf text,
  municipio text,
  url text,
  source_id uuid REFERENCES public.search_sources(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own suppliers" ON public.suppliers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Supplier scores
CREATE TABLE public.supplier_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  confiabilidade numeric DEFAULT 50,
  consistencia_preco numeric DEFAULT 50,
  prazo_medio numeric DEFAULT 50,
  taxa_divergencia numeric DEFAULT 0,
  nota_usuario numeric DEFAULT 0,
  score_final numeric DEFAULT 50,
  total_avaliacoes integer DEFAULT 0,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own scores" ON public.supplier_scores FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Products normalized
CREATE TABLE public.products_normalized (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_normalizado text NOT NULL,
  marca_normalizada text,
  modelo text,
  categoria text,
  unidade text DEFAULT 'UN',
  ncm text,
  atributos jsonb DEFAULT '{}'::jsonb,
  palavras_chave text[] DEFAULT '{}'::text[],
  titulo_original text,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products_normalized ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own products" ON public.products_normalized FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Offers normalized (price offers linked to products)
CREATE TABLE public.offers_normalized (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products_normalized(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.search_sources(id),
  supplier_name text,
  preco numeric NOT NULL,
  frete numeric DEFAULT 0,
  total numeric GENERATED ALWAYS AS (preco + COALESCE(frete, 0)) STORED,
  prazo_dias integer,
  estoque boolean,
  condicao text DEFAULT 'Novo',
  url text,
  uf text,
  coletado_em timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.offers_normalized ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own offers" ON public.offers_normalized FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Shopping lists
CREATE TABLE public.shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  status text DEFAULT 'rascunho',
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own lists" ON public.shopping_lists FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Shopping list items
CREATE TABLE public.shopping_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products_normalized(id),
  descricao text NOT NULL,
  marca text,
  unidade text DEFAULT 'UN',
  quantidade numeric NOT NULL DEFAULT 1,
  preco_referencia numeric,
  fonte_referencia text,
  url_referencia text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own list items" ON public.shopping_list_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.shopping_lists sl WHERE sl.id = list_id AND sl.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.shopping_lists sl WHERE sl.id = list_id AND sl.user_id = auth.uid())
);

-- Quotations
CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  list_id uuid REFERENCES public.shopping_lists(id),
  orgao text,
  processo text,
  status text DEFAULT 'rascunho',
  valor_total numeric DEFAULT 0,
  observacoes text,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own quotations" ON public.quotations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Quotation items
CREATE TABLE public.quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  marca text,
  unidade text DEFAULT 'UN',
  quantidade numeric NOT NULL DEFAULT 1,
  preco_unitario numeric NOT NULL DEFAULT 0,
  frete numeric DEFAULT 0,
  total numeric GENERATED ALWAYS AS (quantidade * preco_unitario + COALESCE(frete, 0)) STORED,
  fonte text,
  fornecedor text,
  url text,
  uf text,
  data_coleta timestamptz DEFAULT now(),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own quotation items" ON public.quotation_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_id AND q.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_id AND q.user_id = auth.uid())
);

-- Search logs (audit)
CREATE TABLE public.search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  termo text NOT NULL,
  filtros jsonb DEFAULT '{}'::jsonb,
  resultados_count integer DEFAULT 0,
  fontes_consultadas text[] DEFAULT '{}'::text[],
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own logs" ON public.search_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own logs" ON public.search_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all logs" ON public.search_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Import jobs
CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.search_sources(id),
  tipo text NOT NULL DEFAULT 'upload_xlsx',
  arquivo_nome text,
  status text DEFAULT 'pendente',
  registros_total integer DEFAULT 0,
  registros_importados integer DEFAULT 0,
  erros jsonb DEFAULT '[]'::jsonb,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own imports" ON public.import_jobs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
