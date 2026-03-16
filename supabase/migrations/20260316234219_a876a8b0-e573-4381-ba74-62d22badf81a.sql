
-- Sub-tarefas dentro de tarefas delegadas
CREATE TABLE public.sub_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid REFERENCES public.tarefas_colaborador(id) ON DELETE CASCADE NOT NULL,
  criado_por uuid NOT NULL,
  titulo text NOT NULL,
  status text DEFAULT 'pendente' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  concluida_em timestamptz
);

ALTER TABLE public.sub_tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage sub_tarefas of their tasks"
  ON public.sub_tarefas FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tarefas_colaborador t
      WHERE t.id = sub_tarefas.tarefa_id
      AND (t.atribuido_a = auth.uid() OR t.criado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tarefas_colaborador t
      WHERE t.id = sub_tarefas.tarefa_id
      AND (t.atribuido_a = auth.uid() OR t.criado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- NF quitada tracking em pedidos
ALTER TABLE public.contrato_pedidos ADD COLUMN nf_quitada boolean DEFAULT false;
ALTER TABLE public.contrato_pedidos ADD COLUMN data_quitacao date;

-- Solicitação de comissão pelo operador
ALTER TABLE public.comissoes_lancamentos ADD COLUMN solicitado_por uuid;
ALTER TABLE public.comissoes_lancamentos ADD COLUMN contrato_pedido_id uuid REFERENCES public.contrato_pedidos(id);

-- Allow operators to insert commission requests (status pendente)
CREATE POLICY "Operators can request commissions"
  ON public.comissoes_lancamentos FOR INSERT TO authenticated
  WITH CHECK (solicitado_por = auth.uid() AND status = 'pendente');
