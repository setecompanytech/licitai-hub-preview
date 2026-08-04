import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
      .select('user_id, nome, email')
      .eq('empresa_id', empresaId);
    
    const memMap: Record<string, string> = {};
    (memData as any[] || []).forEach((m: any) => {
      memMap[m.user_id] = m.nome || m.email || 'Colaborador';
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

  const getModuloBadgeColor = (modulo: string) => {
    const colors: Record<string, string> = {
      juridico: 'bg-blue-500/15 text-blue-600',
      contabil: 'bg-emerald-500/15 text-emerald-600',
      licitacoes: 'bg-amber-500/15 text-amber-600',
      documentos: 'bg-purple-500/15 text-purple-600',
      precificacao: 'bg-orange-500/15 text-orange-600',
      propostas: 'bg-pink-500/15 text-pink-600',
    };
    return colors[modulo] || 'bg-muted text-muted-foreground';
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <Input
            placeholder="Buscar por ação, descrição ou colaborador..."
            value={filtroBusca}
            onChange={e => setFiltroBusca(e.target.value)}
            className="h-9"
          />
        </div>
        <Select value={filtroModulo} onValueChange={setFiltroModulo}>
          <SelectTrigger className="w-[180px] h-9">
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODULOS.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0}>
          <Download className="w-4 h-4 mr-1.5" />
          Exportar CSV
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando atividades...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold mb-1">Nenhuma atividade registrada</p>
          <p className="text-sm text-muted-foreground">As ações dos colaboradores no sistema serão registradas aqui.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(a => (
            <div key={a.id} className="bg-card rounded-lg border border-border/50 px-4 py-2.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                {(membros[a.user_id] || '?').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{membros[a.user_id] || 'Usuário'}</span>
                  <span className="text-sm text-muted-foreground">—</span>
                  <span className="text-sm">{a.acao}</span>
                  <Badge className={`text-xs ${getModuloBadgeColor(a.modulo)}`}>{a.modulo}</Badge>
                </div>
                {a.descricao && <p className="text-xs text-muted-foreground truncate">{a.descricao}</p>}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                {format(new Date(a.created_at), "dd/MM HH:mm", { locale: ptBR })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
