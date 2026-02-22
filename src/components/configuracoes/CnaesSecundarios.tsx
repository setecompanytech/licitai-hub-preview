import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Tag, Search } from 'lucide-react';

const cnaesPopulares = [
  { codigo: '42.11-1', descricao: 'Construção de rodovias e ferrovias' },
  { codigo: '42.13-8', descricao: 'Obras de urbanização' },
  { codigo: '42.22-7', descricao: 'Redes de abastecimento de água e esgoto' },
  { codigo: '41.20-4', descricao: 'Construção de edifícios' },
  { codigo: '43.30-4', descricao: 'Obras de fundações' },
  { codigo: '43.13-4', descricao: 'Obras de terraplenagem' },
  { codigo: '42.91-0', descricao: 'Obras portuárias, marítimas e fluviais' },
  { codigo: '42.92-8', descricao: 'Montagem de instalações industriais' },
  { codigo: '43.21-5', descricao: 'Instalação elétrica' },
  { codigo: '43.22-3', descricao: 'Instalações hidráulicas e sanitárias' },
  { codigo: '43.99-1', descricao: 'Serviços especializados para construção' },
  { codigo: '71.12-0', descricao: 'Serviços de engenharia' },
];

type CnaeItem = { codigo: string; descricao: string };

export default function CnaesSecundarios() {
  const [cnaes, setCnaes] = useState<CnaeItem[]>([
    { codigo: '42.13-8', descricao: 'Obras de urbanização' },
    { codigo: '41.20-4', descricao: 'Construção de edifícios' },
  ]);
  const [busca, setBusca] = useState('');
  const [showSugestoes, setShowSugestoes] = useState(false);

  const sugestoesFiltradas = cnaesPopulares.filter(
    (c) =>
      !cnaes.some((e) => e.codigo === c.codigo) &&
      (c.codigo.includes(busca) || c.descricao.toLowerCase().includes(busca.toLowerCase()))
  );

  const addCnae = (cnae: CnaeItem) => {
    if (!cnaes.some((c) => c.codigo === cnae.codigo)) {
      setCnaes([...cnaes, cnae]);
    }
    setBusca('');
    setShowSugestoes(false);
  };

  const removeCnae = (codigo: string) => {
    setCnaes(cnaes.filter((c) => c.codigo !== codigo));
  };

  return (
    <section className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Tag className="w-5 h-5 text-accent" />
        <h2 className="text-sm font-semibold">CNAEs Secundários para Busca de Licitações</h2>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Cadastre os CNAEs secundários da sua empresa para ampliar as buscas de licitações compatíveis em todos os portais monitorados.
      </p>

      {/* CNAE principal (read-only) */}
      <div className="mb-4 p-3 rounded-lg bg-accent/10 border border-accent/20">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">CNAE Principal</p>
        <p className="text-sm font-semibold text-accent">42.11-1 – Construção de rodovias e ferrovias</p>
      </div>

      {/* CNAEs cadastrados */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">CNAEs Secundários Cadastrados ({cnaes.length})</p>
        <div className="flex flex-wrap gap-2">
          {cnaes.map((cnae) => (
            <Badge
              key={cnae.codigo}
              variant="outline"
              className="bg-primary/10 text-primary border-primary/20 pr-1 flex items-center gap-1"
            >
              <span className="font-mono text-xs">{cnae.codigo}</span>
              <span className="text-[10px]">– {cnae.descricao}</span>
              <button
                onClick={() => removeCnae(cnae.codigo)}
                className="ml-1 p-0.5 rounded hover:bg-destructive/20 transition-colors"
              >
                <X className="w-3 h-3 text-destructive" />
              </button>
            </Badge>
          ))}
          {cnaes.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nenhum CNAE secundário cadastrado</p>
          )}
        </div>
      </div>

      {/* Adicionar CNAE */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar CNAE por código ou descrição..."
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setShowSugestoes(true);
              }}
              onFocus={() => setShowSugestoes(true)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Dropdown sugestões */}
        {showSugestoes && busca.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {sugestoesFiltradas.length > 0 ? (
              sugestoesFiltradas.map((cnae) => (
                <button
                  key={cnae.codigo}
                  onClick={() => addCnae(cnae)}
                  className="w-full text-left px-4 py-2 hover:bg-muted/50 flex items-center gap-2 text-sm transition-colors"
                >
                  <Plus className="w-3 h-3 text-accent" />
                  <span className="font-mono text-xs">{cnae.codigo}</span>
                  <span className="text-muted-foreground">–</span>
                  <span>{cnae.descricao}</span>
                </button>
              ))
            ) : (
              <p className="px-4 py-3 text-xs text-muted-foreground">Nenhum CNAE encontrado</p>
            )}
          </div>
        )}
      </div>

      {/* Quick add popular */}
      <div className="mt-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Sugestões rápidas</p>
        <div className="flex flex-wrap gap-1.5">
          {cnaesPopulares
            .filter((c) => !cnaes.some((e) => e.codigo === c.codigo))
            .slice(0, 6)
            .map((cnae) => (
              <button
                key={cnae.codigo}
                onClick={() => addCnae(cnae)}
                className="text-[11px] px-2 py-1 rounded-md border border-border/50 hover:border-accent hover:text-accent transition-colors"
              >
                <Plus className="w-2.5 h-2.5 inline mr-0.5" />
                {cnae.codigo}
              </button>
            ))}
        </div>
      </div>
    </section>
  );
}
