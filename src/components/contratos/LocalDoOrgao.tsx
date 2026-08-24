import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchMunicipiosUF, UFS_BRASIL, type IBGEMunicipio } from '@/lib/ibge-municipios';
import { cn } from '@/lib/utils';

/**
 * UF e município do órgão, escolhidos de uma lista — não digitados.
 *
 * Eram dois campos de texto livre. "PA", "Pa", "Pará" e "para" viravam quatro
 * lugares diferentes para o sistema, e "BELEM" nunca encontrava "Belém" num
 * filtro. Num cadastro de contrato isso não é detalhe de tela: é o que decide
 * se o relatório por região soma ou perde a linha.
 *
 * Os municípios vêm do IBGE (`lib/ibge-municipios`, com cache de sessão e
 * fontes em cascata) e dependem da UF — porque a lista inteira do país são
 * mais de cinco mil nomes, e a pergunta "qual município" só faz sentido depois
 * de "de qual estado".
 */

type Props = {
  uf: string;
  municipio: string;
  onChange: (patch: { uf?: string; municipio?: string }) => void;
};

export default function LocalDoOrgao({ uf, municipio, onChange }: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [municipios, setMunicipios] = useState<IBGEMunicipio[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!uf) { setMunicipios([]); return; }
    let vivo = true;
    setCarregando(true);
    setErro(null);
    fetchMunicipiosUF(uf)
      .then((lista) => { if (vivo) setMunicipios(lista); })
      // Falha silenciosa aqui deixaria a lista vazia parecendo "não existe
      // município", quando o que houve foi rede.
      .catch(() => { if (vivo) setErro('Não foi possível carregar os municípios.'); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [uf]);

  const filtrados = useMemo(() => {
    const chave = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const q = chave(busca.trim());
    const base = q ? municipios.filter((m) => chave(m.nome).includes(q)) : municipios;
    return base.slice(0, 200);
  }, [municipios, busca]);

  return (
    <>
      <div>
        <Label>UF</Label>
        <Select
          value={uf || undefined}
          // Trocar de estado invalida o município: manter "Belém" sob "SP" seria
          // guardar um endereço que não existe.
          onValueChange={(v) => onChange({ uf: v, municipio: '' })}
        >
          <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {UFS_BRASIL.map((e) => (
              <SelectItem key={e.uf} value={e.uf}>{e.uf} — {e.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Município</Label>
        <Popover open={aberto} onOpenChange={(o) => { setAberto(o); if (o) setBusca(''); }}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={!uf}
              className={cn('mt-1 w-full justify-between font-normal', !municipio && 'text-muted-foreground')}
            >
              {municipio || (uf ? 'Selecione o município' : 'Escolha a UF primeiro')}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar município…"
                className="h-10 border-0 px-0 focus-visible:ring-0"
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {carregando && (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando municípios de {uf}…
                </div>
              )}
              {erro && <p className="px-3 py-3 text-sm text-destructive">{erro}</p>}
              {!carregando && !erro && filtrados.length === 0 && (
                <p className="px-3 py-3 text-sm text-muted-foreground">Nenhum município encontrado.</p>
              )}
              {filtrados.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { onChange({ municipio: m.nome }); setAberto(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <Check className={cn('h-4 w-4 shrink-0', m.nome === municipio ? 'opacity-100' : 'opacity-0')} />
                  {m.nome}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
