-- Enable realtime for key tables that users interact with frequently
ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.documentos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contratos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.editais_favoritos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.empresas;