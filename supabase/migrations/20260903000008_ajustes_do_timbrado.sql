-- Ajustes de posição/dimensão do timbrado de imagem (03/09/2026):
-- alinhamento, largura e deslocamento do cabeçalho e do rodapé, mais a
-- configuração de página (papel, orientação, margens) — que até aqui vivia
-- só no estado da tela e se perdia a cada visita.
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS timbrado_ajustes jsonb;
