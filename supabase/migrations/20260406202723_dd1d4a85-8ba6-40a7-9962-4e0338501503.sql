
-- Catálogo de segmentos disponíveis no sistema
CREATE TABLE IF NOT EXISTS segmentos_licitacao (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      TEXT NOT NULL UNIQUE,
  nome        TEXT NOT NULL,
  descricao   TEXT,
  categoria   TEXT NOT NULL,
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Preferências de alerta por usuário/empresa
CREATE TABLE IF NOT EXISTS preferencias_alertas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cnpj                  TEXT,
  razao_social          TEXT,
  segmentos             TEXT[] DEFAULT '{}',
  ufs                   TEXT[] DEFAULT '{}',
  receber_editais       BOOLEAN DEFAULT true,
  receber_alteracoes    BOOLEAN DEFAULT true,
  receber_suspensoes    BOOLEAN DEFAULT true,
  receber_cancelamentos BOOLEAN DEFAULT true,
  receber_homologacoes  BOOLEAN DEFAULT true,
  canal_email           BOOLEAN DEFAULT true,
  canal_whatsapp        BOOLEAN DEFAULT false,
  canal_push            BOOLEAN DEFAULT true,
  email_notificacao     TEXT,
  whatsapp_notificacao  TEXT,
  frequencia            TEXT DEFAULT 'imediato',
  ativo                 BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Alertas gerados pelo sistema
CREATE TABLE IF NOT EXISTS alertas_gerados (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL,
  titulo          TEXT NOT NULL,
  descricao       TEXT NOT NULL,
  orgao           TEXT,
  uf              TEXT,
  segmento        TEXT,
  numero_processo TEXT,
  numero_pregao   TEXT,
  cnpj_orgao      TEXT,
  valor_estimado  DECIMAL(15,2),
  data_abertura   TIMESTAMPTZ,
  url_edital      TEXT,
  url_publicacao  TEXT,
  fonte           TEXT NOT NULL,
  lido            BOOLEAN DEFAULT false,
  arquivado       BOOLEAN DEFAULT false,
  urgente         BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Publicações do DOU/DOE já processadas (evitar duplicatas)
CREATE TABLE IF NOT EXISTS publicacoes_dou_processadas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador   TEXT NOT NULL UNIQUE,
  tipo_publicacao TEXT,
  data_publicacao DATE,
  orgao           TEXT,
  cnpj_mencionado TEXT,
  processo_mencionado TEXT,
  conteudo_resumo TEXT,
  processado_em   TIMESTAMPTZ DEFAULT now()
);

-- Log de notificações enviadas
CREATE TABLE IF NOT EXISTS notificacoes_enviadas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alerta_id   UUID REFERENCES alertas_gerados(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canal       TEXT NOT NULL,
  status      TEXT NOT NULL,
  tentativas  INTEGER DEFAULT 1,
  erro        TEXT,
  enviado_em  TIMESTAMPTZ DEFAULT now()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_alertas_user_lido ON alertas_gerados (user_id, lido, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_tipo ON alertas_gerados (user_id, tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_preferencias_user ON preferencias_alertas (user_id);
CREATE INDEX IF NOT EXISTS idx_alertas_arquivado ON alertas_gerados (user_id, arquivado, created_at DESC);

-- RLS
ALTER TABLE preferencias_alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_gerados ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes_enviadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE publicacoes_dou_processadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own alert preferences" ON preferencias_alertas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own alerts" ON alertas_gerados FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own alerts" ON alertas_gerados FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service inserts alerts" ON alertas_gerados FOR INSERT WITH CHECK (true);
CREATE POLICY "Users read own notifications" ON notificacoes_enviadas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service inserts notifications" ON notificacoes_enviadas FOR INSERT WITH CHECK (true);
CREATE POLICY "Service manages DOU records" ON publicacoes_dou_processadas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public read segments" ON segmentos_licitacao FOR SELECT USING (true);

-- Enable RLS on segmentos
ALTER TABLE segmentos_licitacao ENABLE ROW LEVEL SECURITY;

-- Enable realtime for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.alertas_gerados;

-- Seed segments
INSERT INTO segmentos_licitacao (codigo, nome, descricao, categoria) VALUES
  ('ALI-001', 'Gêneros alimentícios perecíveis', 'Carnes, laticínios, frutas, verduras, frios', 'Alimentação'),
  ('ALI-002', 'Gêneros alimentícios não perecíveis', 'Enlatados, grãos, farinhas, conservas, temperos', 'Alimentação'),
  ('ALI-003', 'Cestas básicas', 'Kits e cestas de alimentos para distribuição', 'Alimentação'),
  ('ALI-004', 'Merenda escolar (PNAE)', 'Produtos do Programa Nacional de Alimentação Escolar', 'Alimentação'),
  ('ALI-005', 'Água mineral e bebidas', 'Água mineral, sucos, isotônicos, cafés', 'Alimentação'),
  ('ALI-006', 'Serviços de alimentação/refeições', 'Fornecimento de refeições, restaurantes, buffets', 'Alimentação'),
  ('TI-001', 'Equipamentos de informática', 'Computadores, notebooks, servidores, monitores', 'Tecnologia'),
  ('TI-002', 'Suprimentos de informática', 'Cartuchos, tonners, cabos, periféricos', 'Tecnologia'),
  ('TI-003', 'Software e licenças', 'Sistemas operacionais, pacotes office, ERPs', 'Tecnologia'),
  ('TI-004', 'Serviços de TI', 'Desenvolvimento, suporte, manutenção de sistemas', 'Tecnologia'),
  ('TI-005', 'Infraestrutura de rede', 'Switches, roteadores, cabeamento, wireless', 'Tecnologia'),
  ('LIM-001', 'Materiais de limpeza e higienização', 'Detergentes, desinfetantes, álcool, sabão', 'Higiene e Limpeza'),
  ('LIM-002', 'Materiais de higiene pessoal', 'Sabonete, papel higiênico, toalhas, shampoo', 'Higiene e Limpeza'),
  ('LIM-003', 'Produtos descartáveis', 'Copos, pratos, talheres, sacolas descartáveis', 'Higiene e Limpeza'),
  ('LIM-004', 'Serviços de limpeza e conservação', 'Terceirização de limpeza, portaria, vigilância', 'Higiene e Limpeza'),
  ('ESC-001', 'Material de escritório', 'Papel, canetas, grampos, envelopes, pastas', 'Escritório'),
  ('ESC-002', 'Mobiliário e cadeiras', 'Mesas, cadeiras, armários, estantes', 'Escritório'),
  ('MED-001', 'Medicamentos e insumos farmacêuticos', 'Remédios, seringas, soros, curativos', 'Saúde'),
  ('MED-002', 'Equipamentos médico-hospitalares', 'Aparelhos, instrumentos, mobiliário hospitalar', 'Saúde'),
  ('MED-003', 'Serviços de saúde', 'Exames, consultas, terceirização hospitalar', 'Saúde'),
  ('OBR-001', 'Obras e reformas', 'Construção civil, reforma, adequação de espaços', 'Engenharia'),
  ('OBR-002', 'Materiais de construção', 'Cimento, tinta, tijolos, elétricos, hidráulicos', 'Engenharia'),
  ('OBR-003', 'Serviços de engenharia', 'Projetos, consultoria, fiscalização de obras', 'Engenharia'),
  ('VEI-001', 'Veículos e locação de veículos', 'Carros, vans, ônibus, locação com ou sem motorista', 'Transporte'),
  ('VEI-002', 'Peças e manutenção veicular', 'Autopeças, pneus, serviços mecânicos', 'Transporte'),
  ('COM-001', 'Combustíveis e lubrificantes', 'Gasolina, diesel, óleo, graxas', 'Combustíveis'),
  ('UNI-001', 'Uniformes e EPIs', 'Fardamento, calçados, capacetes, luvas, coletes', 'Vestuário'),
  ('GRA-001', 'Gráfica e impressão', 'Impressos, banners, envelopes personalizados', 'Gráfica'),
  ('EVE-001', 'Eventos e locações', 'Auditórios, tendas, equipamentos audiovisuais', 'Eventos'),
  ('SEG-001', 'Segurança e vigilância', 'Vigilância armada, monitoramento eletrônico', 'Segurança')
ON CONFLICT (codigo) DO NOTHING;
