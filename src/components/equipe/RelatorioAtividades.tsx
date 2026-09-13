import { useState, useEffect } from 'react';
import { nomeExibido } from '@/lib/equipe/nomeExibido';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Download, Filter, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MODULOS = [
  { value: 'todos', label: 'Todos os módulos' },
  { value: 'juridico', label: 'Jurídico' },
  { value: 'contabil', label: 'Contábil' },
  { value: 'licitacoes', label: 'Licitações' },
  { value: 'documentos', label: 'Documentos' },
  { value: 'precificacao', label: 'Precificação' },
  { value: 'propostas', label: 'Propostas' },
  { value: 'configuracoes', label: 'Configurações' },
  { value: 'geral', label: 'Geral' },
];

type Atividade = {
  id: string;
  user_id: string;
  acao: string;
  modulo: string;
  descricao: string | null;
  created_at: string;
  metadata: any;
};

export default function RelatorioAtividades({ empresaId }: { empresaId: string }) {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroModulo, setFiltroModulo] = useState('todos');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [membros, setMembros] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, [empresaId, filtroModulo]);

  const loadData = async () => {
    setLoading(true);

    // Load members names
    const { data: memData } = await supabase
      .from('empresa_membros')
      .select('user_id, nome, email, nome_individual, login_individual')
      .eq('empresa_id', empresaId);
    
    const memMap: Record<string, string> = {};
    (memData as any[] || []).forEach((m: any) => {
      memMap[m.user_id] = nomeExibido(m as never);
    });
    setMembros(memMap);

    // Load activities
    let query = supabase
      .from('atividades_colaborador' as any)
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (filtroModulo !== 'todos') {
      query = query.eq('modulo', filtroModulo);
    }

    const { data } = await query;
    setAtividades((data as any[]) || []);
    setLoading(false);
  };

  const filtered = atividades.filter(a => {
    if (!filtroBusca) return true;
    const search = filtroBusca.toLowerCase();
    return (
      a.acao.toLowerCase().includes(search) ||
      (a.descricao || '').toLowerCase().includes(search) ||
      (membros[a.user_id] || '').toLowerCase().includes(search)
    );
  });

  const exportCSV = () => {
    const rows = [
      ['Data/Hora', 'Colaborador', 'Módulo', 'Ação', 'Descrição'],
      ...filtered.map(a => [
        format(new Date(a.created_at), 'dd/MM/yyyy HH:mm'),
        membros[a.user_id] || a.user_id,
        a.modulo,
        a.acao,
        a.descricao || '',
      ])
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-atividades-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rotuloModulo = (modulo: string) =>
    MODULOS.find(m => m.value === modulo)?.label ?? modulo;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <Input
            placeholder="Buscar por ação, descrição ou colaborador..."
            value={filtroBusca}
            onChange={e => setFiltroBusca(e.target.value)}
            aria-label="Buscar atividade"
          />
        </div>
        <Select value={filtroModulo} onValueChange={setFiltroModulo}>
          <SelectTrigger className="w-[200px]" aria-label="Filtrar por módulo">
            <Filter className="mr-1.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODULOS.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
          <Download aria-hidden="true" />
          Exportar CSV
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-base text-muted-foreground">Carregando atividades...</div>
      ) : filtered.length === 0 ? (
        <section className="rounded-lg border border-border bg-card shadow-sm">
          <EstadoVazio
            icone={<Clock />}
            titulo="Nenhuma atividade registrada"
            descricao="As ações dos colaboradores no sistema serão registradas aqui."
          />
        </section>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                {(membros[a.user_id] || '?').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{membros[a.user_id] || 'Usuário'}</span>
                  <span className="text-sm text-muted-foreground">—</span>
                  <span className="text-sm text-foreground">{a.acao}</span>
                  <Badge variant="muted">{rotuloModulo(a.modulo)}</Badge>
                </div>
                {a.descricao && <p className="truncate text-sm text-muted-foreground">{a.descricao}</p>}
              </div>
              <span className="flex-shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                {format(new Date(a.created_at), "dd/MM HH:mm", { locale: ptBR })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
