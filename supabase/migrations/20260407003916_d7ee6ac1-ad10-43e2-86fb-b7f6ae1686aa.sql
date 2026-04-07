
-- Drop todas as 3 tabelas incompletas
DROP TABLE IF EXISTS segmentos_licitacao CASCADE;
DROP TABLE IF EXISTS portais_monitorados CASCADE;
DROP TABLE IF EXISTS notificacoes_enviadas CASCADE;
DROP FUNCTION IF EXISTS metricas_notificacoes;

-- TABELA 1: segmentos_licitacao
CREATE TABLE segmentos_licitacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL,
  palavras_chave TEXT[] DEFAULT '{}',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_seg_cat ON segmentos_licitacao (categoria, ativo);
CREATE INDEX idx_seg_kw ON segmentos_licitacao USING GIN (palavras_chave);
ALTER TABLE segmentos_licitacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_seg" ON segmentos_licitacao FOR SELECT USING (true);
CREATE POLICY "adm_seg" ON segmentos_licitacao FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "svc_seg" ON segmentos_licitacao FOR ALL TO service_role USING (true);

-- TABELA 2: portais_monitorados
CREATE TABLE portais_monitorados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  url_base TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'api',
  uf TEXT,
  endpoint_api TEXT,
  ativo BOOLEAN DEFAULT true,
  intervalo_min INTEGER DEFAULT 360,
  ultima_coleta TIMESTAMPTZ,
  total_coletados INTEGER DEFAULT 0,
  status_atual TEXT DEFAULT 'aguardando',
  ultimo_erro TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_port_ativo ON portais_monitorados (ativo, intervalo_min);
ALTER TABLE portais_monitorados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_port" ON portais_monitorados FOR SELECT USING (true);
CREATE POLICY "adm_port" ON portais_monitorados FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "svc_port" ON portais_monitorados FOR ALL TO service_role USING (true);
CREATE TRIGGER tg_port_upd BEFORE UPDATE ON portais_monitorados FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- TABELA 3: notificacoes_enviadas
CREATE TABLE notificacoes_enviadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  alerta_ref_id TEXT,
  alerta_tipo TEXT,
  alerta_titulo TEXT,
  canal TEXT NOT NULL,
  destinatario TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  tentativas INTEGER DEFAULT 1,
  max_tentativas INTEGER DEFAULT 3,
  wamid TEXT,
  resend_id TEXT,
  push_token TEXT,
  erro_codigo TEXT,
  erro_mensagem TEXT,
  agendado_para TIMESTAMPTZ,
  enviado_em TIMESTAMPTZ,
  entregue_em TIMESTAMPTZ,
  lido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_nenv_uc ON notificacoes_enviadas (user_id, canal, created_at DESC);
CREATE INDEX idx_nenv_st ON notificacoes_enviadas (status, created_at DESC) WHERE status IN ('pendente','falhou');
CREATE INDEX idx_nenv_wa ON notificacoes_enviadas (wamid) WHERE wamid IS NOT NULL;
ALTER TABLE notificacoes_enviadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_nenv_own" ON notificacoes_enviadas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sel_nenv_adm" ON notificacoes_enviadas FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "svc_nenv" ON notificacoes_enviadas FOR ALL TO service_role USING (true);

-- FUNÇÃO: metricas_notificacoes
CREATE OR REPLACE FUNCTION metricas_notificacoes(p_dias INTEGER DEFAULT 7)
RETURNS TABLE (canal TEXT, total BIGINT, enviados BIGINT, entregues BIGINT, falhos BIGINT, taxa_sucesso NUMERIC, taxa_entrega NUMERIC)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path TO 'public'
AS $$
  SELECT canal, COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'enviado') AS enviados,
    COUNT(*) FILTER (WHERE status = 'entregue') AS entregues,
    COUNT(*) FILTER (WHERE status = 'falhou') AS falhos,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status != 'falhou') / NULLIF(COUNT(*), 0), 1),
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'entregue') / NULLIF(COUNT(*) FILTER (WHERE status != 'falhou'), 0), 1)
  FROM notificacoes_enviadas WHERE created_at >= now() - (p_dias || ' days')::interval
  GROUP BY canal ORDER BY total DESC
$$;
GRANT EXECUTE ON FUNCTION metricas_notificacoes TO authenticated;

-- DADOS INICIAIS: segmentos
INSERT INTO segmentos_licitacao (codigo, nome, descricao, categoria, palavras_chave) VALUES
  ('ALI-001','Gêneros alimentícios perecíveis','Carnes, laticínios, frutas','Alimentação', ARRAY['carne','frango','peixe','leite','queijo','fruta','verdura','perecivel','frios']),
  ('ALI-002','Gêneros alimentícios não perecíveis','Enlatados, grãos, farinhas','Alimentação', ARRAY['arroz','feijao','oleo','sal','acucar','farinha','macarrao','enlatado','grao']),
  ('ALI-003','Cestas básicas','Kits e cestas de alimentos','Alimentação', ARRAY['cesta basica','kit alimentar']),
  ('ALI-004','Merenda escolar (PNAE)','Alimentação Escolar','Alimentação', ARRAY['merenda','pnae','alimentacao escolar','agricultura familiar']),
  ('ALI-005','Água mineral e bebidas','Água, sucos, cafés','Alimentação', ARRAY['agua mineral','suco','cafe','bebida','galao']),
  ('ALI-006','Serviços de alimentação','Refeições, buffets','Alimentação', ARRAY['refeicao','restaurante','buffet','alimentacao coletiva']),
  ('TI-001','Equipamentos de informática','Computadores, notebooks','Tecnologia', ARRAY['computador','notebook','servidor','monitor','desktop','laptop','tablet']),
  ('TI-002','Suprimentos de informática','Cartuchos, periféricos','Tecnologia', ARRAY['cartucho','toner','cabo','mouse','teclado','impressora','scanner']),
  ('TI-003','Software e licenças','Sistemas, ERPs','Tecnologia', ARRAY['software','licenca','sistema','windows','office','erp','antivirus']),
  ('TI-004','Serviços de TI','Desenvolvimento, suporte','Tecnologia', ARRAY['desenvolvimento','suporte','ti','consultoria ti','helpdesk','nuvem','cloud']),
  ('TI-005','Infraestrutura de rede','Switches, roteadores','Tecnologia', ARRAY['switch','roteador','cabeamento','rede','wireless','firewall','fibra optica']),
  ('LIM-001','Materiais de limpeza','Detergentes, desinfetantes','Higiene e Limpeza', ARRAY['detergente','desinfetante','alcool','sabao','limpeza']),
  ('LIM-002','Materiais de higiene pessoal','Sabonete, papel higiênico','Higiene e Limpeza', ARRAY['papel higienico','sabonete','toalha','shampoo','fralda']),
  ('LIM-003','Produtos descartáveis','Copos, pratos descartáveis','Higiene e Limpeza', ARRAY['descartavel','copo plastico','sacola','embalagem']),
  ('LIM-004','Serviços de limpeza','Terceirização de limpeza','Higiene e Limpeza', ARRAY['servico limpeza','conservacao predial','higienizacao','zeladoria']),
  ('ESC-001','Material de escritório','Papel, canetas, grampos','Escritório', ARRAY['papel a4','caneta','grampo','pasta','envelope','clips']),
  ('ESC-002','Mobiliário e cadeiras','Mesas, cadeiras, armários','Escritório', ARRAY['mesa','cadeira','armario','estante','mobiliario']),
  ('MED-001','Medicamentos e insumos','Remédios, seringas, soros','Saúde', ARRAY['medicamento','remedio','farmaco','vacina','soro','seringa','curativo']),
  ('MED-002','Equipamentos hospitalares','Aparelhos, instrumentos','Saúde', ARRAY['equipamento medico','hospitalar','cirurgico','laboratorio']),
  ('MED-003','Serviços de saúde','Exames, consultas','Saúde', ARRAY['servico saude','exame','consulta','atendimento medico']),
  ('OBR-001','Obras e reformas','Construção civil, reforma','Engenharia', ARRAY['obra','reforma','construcao','edificio','pavimentacao']),
  ('OBR-002','Materiais de construção','Cimento, tinta, tijolos','Engenharia', ARRAY['cimento','tinta','tijolo','telha','areia','brita','piso']),
  ('OBR-003','Serviços de engenharia','Projetos, consultoria','Engenharia', ARRAY['projeto','consultoria engenharia','fiscalizacao','laudo']),
  ('VEI-001','Veículos e locação','Carros, vans, ônibus','Transporte', ARRAY['veiculo','carro','van','onibus','caminhao','frota','ambulancia']),
  ('VEI-002','Peças e manutenção veicular','Autopeças, pneus','Transporte', ARRAY['peca','pneu','mecanica','manutencao veiculo','autopeca']),
  ('COM-001','Combustíveis e lubrificantes','Gasolina, diesel, óleo','Combustíveis', ARRAY['combustivel','gasolina','diesel','etanol','oleo','lubrificante']),
  ('UNI-001','Uniformes e EPIs','Fardamento, calçados','Vestuário', ARRAY['uniforme','epi','fardamento','calcado','capacete','luva','bota']),
  ('GRA-001','Gráfica e impressão','Impressos, banners','Gráfica', ARRAY['grafica','impressao','banner','panfleto','folder','plotagem']),
  ('EVE-001','Eventos e locações','Auditórios, tendas','Eventos', ARRAY['evento','auditorio','tenda','audiovisual','sonorizacao','palco']),
  ('SEG-001','Segurança e vigilância','Vigilância, monitoramento','Segurança', ARRAY['vigilancia','seguranca','monitoramento','camera','alarme']);

-- DADOS INICIAIS: portais
INSERT INTO portais_monitorados (nome, url_base, tipo, uf, endpoint_api, intervalo_min) VALUES
  ('PNCP Federal','https://pncp.gov.br','api',NULL,'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao',30),
  ('TCM-PA Mural','https://www.tcm.pa.gov.br','scraping','PA','https://www.tcm.pa.gov.br/mural-de-licitacoes/',120),
  ('Licitanet','https://www.licitanet.com.br','rss',NULL,'https://www.licitanet.com.br/feed/rss',180),
  ('BLL','https://bll.org.br','api',NULL,'https://bll.org.br/api/v1/licitacoes',240),
  ('BanParaNet','https://www.banparanet.com.br','scraping','PA','https://www.banparanet.com.br/licitacoes',180),
  ('Querido Diário (DOU)','https://queridodiario.ok.org.br','api',NULL,'https://queridodiario.ok.org.br/api/gazettes',360),
  ('ComprasNet Federal','https://compras.dados.gov.br','api',NULL,'https://compras.dados.gov.br/licitacoes/v1/licitacoes.json',360);
