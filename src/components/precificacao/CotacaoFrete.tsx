import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Truck, MapPin, Package, Clock, Loader2, Calculator, X, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type FreteOpcao = {
  modalidade: string;
  transportadora: string;
  prazo_dias: number;
  valor: number;
  descricao: string;
};

export type CotacaoFreteResult = {
  origem: { cep: string; cidade: string; uf: string };
  destino: { cep: string; cidade: string; uf: string };
  distancia_estimada_km: number;
  opcoes: FreteOpcao[];
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return digits;
}

type Props = {
  onFreteCalculado?: (frete: CotacaoFreteResult) => void;
  precoProduto?: number;
  compact?: boolean;
};

export function CotacaoFrete({ onFreteCalculado, precoProduto, compact = false }: Props) {
  const [cepOrigem, setCepOrigem] = useState('');
  const [cepDestino, setCepDestino] = useState('');
  const [peso, setPeso] = useState('1');
  const [isLoading, setIsLoading] = useState(false);
  const [resultado, setResultado] = useState<CotacaoFreteResult | null>(null);
  const [expanded, setExpanded] = useState(!compact);
  const [selectedModalidade, setSelectedModalidade] = useState<string | null>(null);

  const handleCotar = async () => {
    const cleanOrigem = cepOrigem.replace(/\D/g, '');
    const cleanDestino = cepDestino.replace(/\D/g, '');

    if (cleanOrigem.length !== 8) {
      toast.error('CEP de origem inválido. Deve ter 8 dígitos.');
      return;
    }
    if (cleanDestino.length !== 8) {
      toast.error('CEP de destino inválido. Deve ter 8 dígitos.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cotacao-frete', {
        body: {
          cep_origem: cleanOrigem,
          cep_destino: cleanDestino,
          peso: parseFloat(peso) || 1,
          valor_produto: precoProduto || 100,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || 'Erro ao calcular frete');
        return;
      }

      setResultado(data.data);
      onFreteCalculado?.(data.data);

      // Auto-select cheapest non-free option
      const opcoes = data.data.opcoes as FreteOpcao[];
      const cheapest = opcoes.find(o => o.valor > 0) || opcoes[0];
      setSelectedModalidade(cheapest?.modalidade || null);

      toast.success('Frete calculado com sucesso!');
    } catch (e) {
      console.error('Erro cotação:', e);
      toast.error('Erro ao calcular frete.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedFrete = resultado?.opcoes.find(o => o.modalidade === selectedModalidade);

  return (
    <div className="bg-card border border-border/40 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            <Truck className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-semibold text-foreground">Cotação de Frete</h4>
            {resultado && !expanded && (
              <p className="text-xs text-muted-foreground">
                {resultado.origem.cidade}/{resultado.origem.uf} → {resultado.destino.cidade}/{resultado.destino.uf}
                {selectedFrete && (
                  <span className="ml-1 text-foreground font-medium">
                    · {selectedFrete.modalidade}: {selectedFrete.valor === 0 ? 'Grátis' : formatCurrency(selectedFrete.valor)} ({selectedFrete.prazo_dias} dias)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/20 pt-3">
          {/* CEP Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> CEP Origem
              </label>
              <Input
                placeholder="00000-000"
                value={cepOrigem}
                onChange={(e) => setCepOrigem(formatCep(e.target.value))}
                className="h-9 text-sm"
                maxLength={9}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> CEP Destino
              </label>
              <Input
                placeholder="00000-000"
                value={cepDestino}
                onChange={(e) => setCepDestino(formatCep(e.target.value))}
                className="h-9 text-sm"
                maxLength={9}
              />
            </div>
          </div>

          {/* Weight + Calculate */}
          <div className="flex gap-3 items-end">
            <div className="w-[120px]">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <Package className="w-3 h-3" /> Peso (kg)
              </label>
              <Input
                type="number"
                placeholder="1.0"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                className="h-9 text-sm"
                min="0.1"
                step="0.1"
              />
            </div>
            <Button
              onClick={handleCotar}
              disabled={isLoading}
              className="h-9 flex-1 bg-primary hover:bg-primary/90"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Calculando...</>
              ) : (
                <><Calculator className="w-4 h-4 mr-1" /> Calcular Frete</>
              )}
            </Button>
          </div>

          {/* Results */}
          {resultado && (
            <div className="space-y-2 mt-2">
              {/* Route info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                <span className="font-medium text-foreground">{resultado.origem.cidade}/{resultado.origem.uf}</span>
                <span>→</span>
                <span className="font-medium text-foreground">{resultado.destino.cidade}/{resultado.destino.uf}</span>
                <span className="ml-auto text-xs">~{resultado.distancia_estimada_km} km</span>
              </div>

              {/* Freight options */}
              <div className="space-y-1.5">
                {resultado.opcoes.map((opcao) => {
                  const isSelected = selectedModalidade === opcao.modalidade;
                  const totalComFrete = precoProduto ? precoProduto + opcao.valor : opcao.valor;

                  return (
                    <button
                      key={opcao.modalidade}
                      onClick={() => setSelectedModalidade(opcao.modalidade)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border/40 hover:border-primary/30 hover:bg-muted/20'
                      }`}
                    >
                      {/* Radio indicator */}
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-primary' : 'border-muted-foreground/30'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{opcao.modalidade}</span>
                          <span className="text-xs text-muted-foreground">· {opcao.transportadora}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{opcao.descricao}</p>
                      </div>

                      {/* Prazo */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                        <Clock className="w-3 h-3" />
                        <span>{opcao.prazo_dias} dias</span>
                      </div>

                      {/* Valor */}
                      <div className="text-right flex-shrink-0 min-w-[80px]">
                        {opcao.valor === 0 ? (
                          <Badge className="bg-success/10 text-success border-success/20 text-xs">Grátis</Badge>
                        ) : (
                          <span className="text-sm font-semibold text-foreground">{formatCurrency(opcao.valor)}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Total with freight */}
              {precoProduto && selectedFrete && (
                <div className="bg-gradient-to-r from-primary/5 to-success/5 border border-primary/20 rounded-lg p-3 mt-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Custo Total (Produto + Frete)</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatCurrency(precoProduto)}</span>
                        <span>+</span>
                        <span>{selectedFrete.valor === 0 ? 'Grátis' : formatCurrency(selectedFrete.valor)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-foreground">
                        {formatCurrency(precoProduto + selectedFrete.valor)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Entrega em até {selectedFrete.prazo_dias} dias úteis
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Compact inline freight display for product cards */
export function FreteInlineDisplay({ frete }: { frete: FreteOpcao | null }) {
  if (!frete) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Truck className="w-3 h-3 text-muted-foreground" />
      {frete.valor === 0 ? (
        <span className="text-success font-semibold">Frete grátis</span>
      ) : (
        <span className="text-muted-foreground">
          Frete: <span className="font-medium text-foreground">{formatCurrency(frete.valor)}</span>
        </span>
      )}
      <span className="text-muted-foreground">·</span>
      <Clock className="w-3 h-3 text-muted-foreground" />
      <span className="text-muted-foreground">{frete.prazo_dias} dias</span>
    </div>
  );
}
