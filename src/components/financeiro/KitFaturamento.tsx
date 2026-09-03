import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { FileArchive, FileText, Loader2, Package, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  avaliarCertidoes, podeEnviar, type CertidaoAvaliada, type DocumentoEmpresa,
} from '@/lib/faturamento/certidoes';
import { baixarCertidoes, indiceDoKit, montarPdfUnico, montarZip, baixar } from '@/lib/faturamento/kit';
import { numeroDoEmpenho } from '@/lib/faturamento/numero-do-empenho';
import { gerarReciboPdf, type DadosDoRecibo } from '@/lib/faturamento/recibo';

/**
 * Kit que acompanha a NF-e: recibo de quitação + certidões negativas.
 *
 * O alerta vem ANTES do download, não depois: certidão vencida enviada ao
 * órgão volta como pendência e trava o pagamento. Vencida não entra no pacote,
 * mas aparece nomeada na lista e no índice — a falta é informada, nunca
 * silenciosa.
 */

const CORES: Record<CertidaoAvaliada['situacao'], string> = {
  valida: 'bg-success/10 text-success border-success/30',
  vence_em_breve: 'bg-warning/10 text-warning border-warning/30',
  sem_validade: 'bg-muted text-muted-foreground border-border',
  vencida: 'bg-destructive/10 text-destructive border-destructive/30',
  ausente: 'bg-destructive/10 text-destructive border-destructive/30',
};

const ROTULOS: Record<CertidaoAvaliada['situacao'], string> = {
  valida: 'válida',
  vence_em_breve: 'vence em breve',
  sem_validade: 'sem validade cadastrada',
  vencida: 'vencida',
  ausente: 'não cadastrada',
};

type Props = {
  pedido: {
    id: string;
    numero_pedido: string;
    valor_total: number;
    nota_fiscal?: string | null;
    contrato_id: string;
    /** Opcionais: a aba do contrato não os tem em mãos, e o kit busca. */
    contrato_numero?: string | null;
    orgao?: string | null;
  };
};

type ContaBancaria = { id: string; nome: string; banco_nome: string | null; agencia: string | null; conta: string | null };

export default function KitFaturamento({ pedido }: Props) {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  // O recibo se APRESENTA ao órgão: empenho e conta são conferidos por quem
  // gera, não adivinhados pelo sistema — seleção explícita, com pré-escolha
  // quando as fontes não deixam dúvida.
  const [empenhos, setEmpenhos] = useState<Array<{ id: string; numero: string }>>([]);
  const [empenhoSel, setEmpenhoSel] = useState('');
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [contaSel, setContaSel] = useState('');
  /** O empenho_id que o pedido JÁ tinha — para gravar o vínculo só quando a
   *  escolha do kit acrescenta informação nova. */
  const [vinculoOriginal, setVinculoOriginal] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [gerando, setGerando] = useState<'zip' | 'pdf' | null>(null);
  const [certidoes, setCertidoes] = useState<CertidaoAvaliada[]>([]);
  const [remessa, setRemessa] = useState<number | null>(null);
  const [contrato, setContrato] = useState<{ numero: string | null; orgao: string | null }>({
    numero: pedido.contrato_numero ?? null,
    orgao: pedido.orgao ?? null,
  });

  useEffect(() => {
    if (!aberto || !empresaAtiva?.id) return;
    let vivo = true;
    (async () => {
      setCarregando(true);
      const [docsRes, pedidosRes, contratoRes, empenhosRes, pedRes, contasRes] = await Promise.all([
        // A MESMA régua da página Jurídico → Documentos: linhas da empresa +
        // legado privado do próprio usuário. Só empresa_id estrito deixava o
        // colega gerar kit com uma certidão só — as demais eram linhas que o
        // colega dono ainda não compartilhou.
        (supabase.from('documentos') as any)
          .select('id, nome, validade, arquivo_path, empresa_id')
          .or(`empresa_id.eq.${empresaAtiva.id},and(user_id.eq.${user?.id ?? '00000000-0000-0000-0000-000000000000'},empresa_id.is.null)`),
        // Qual remessa é esta dentro do contrato — "8ª remessa" no recibo.
        supabase.from('contrato_pedidos')
          .select('id, data_pedido')
          .eq('contrato_id', pedido.contrato_id)
          .neq('status', 'cancelado')
          .order('data_pedido', { ascending: true }),
        supabase.from('contratos')
          .select('numero_contrato, orgao_contratante')
          .eq('id', pedido.contrato_id)
          .maybeSingle(),
        // Sem filtro de cancelamento: `cancelado` NÃO é coluna — é derivado
        // dos movimentos de anulação no painel. Filtrar por coluna inexistente
        // fazia a consulta falhar em silêncio e a lista vinha vazia.
        supabase.from('contrato_empenhos' as never)
          .select('id, numero')
          .eq('contrato_id', pedido.contrato_id)
          .order('numero'),
        supabase.from('contrato_pedidos')
          .select('empenho_id')
          .eq('id', pedido.id)
          .maybeSingle(),
        // A conta do recibo vem do Financeiro DE VERDADE (financeiro_contas).
        // `fin_contas` é a família legada morta — a consulta voltava vazia e o
        // recibo saía sem banco/agência/conta desde sempre.
        supabase.from('financeiro_contas')
          .select('id, nome, banco_nome, agencia, conta')
          .eq('empresa_id', empresaAtiva.id)
          .order('nome'),
      ]);
      if (!vivo) return;
      // Linha da empresa vence a linha legada de mesmo nome.
      const brutos = ((docsRes.data as Array<DocumentoEmpresa & { empresa_id: string | null }>) ?? []);
      const porNome = new Map<string, DocumentoEmpresa>();
      for (const d of brutos) if (d.empresa_id) porNome.set(d.nome, d);
      for (const d of brutos) if (!porNome.has(d.nome)) porNome.set(d.nome, d);
      setCertidoes(avaliarCertidoes([...porNome.values()]));

      const listaEmp = ((empenhosRes.data as unknown as Array<{ id: string; numero: string }>) ?? []);
      setEmpenhos(listaEmp);
      const empenhoVinculadoId = (pedRes.data as unknown as { empenho_id: string | null } | null)?.empenho_id;
      setVinculoOriginal(empenhoVinculadoId ?? null);
      const doVinculo = listaEmp.find((e) => e.id === empenhoVinculadoId)?.numero;
      // Pré-escolha sem ambiguidade: o vínculo do pedido; senão, empenho único.
      setEmpenhoSel(doVinculo ?? (listaEmp.length === 1 ? listaEmp[0].numero : ''));

      const listaContas = ((contasRes.data as unknown as ContaBancaria[]) ?? [])
        .filter((c) => c.banco_nome || c.agencia || c.conta);
      setContas(listaContas);
      setContaSel(listaContas.length === 1 ? listaContas[0].id : '');
      const ordem = ((pedidosRes.data as { id: string }[]) ?? []).findIndex((p) => p.id === pedido.id);
      setRemessa(ordem >= 0 ? ordem + 1 : null);
      const c = contratoRes.data as { numero_contrato?: string; orgao_contratante?: string } | null;
      setContrato({
        numero: pedido.contrato_numero ?? c?.numero_contrato ?? null,
        orgao: pedido.orgao ?? c?.orgao_contratante ?? null,
      });
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [aberto, empresaAtiva?.id, pedido.id, pedido.contrato_id]);

  const vencidas = certidoes.filter((c) => c.situacao === 'vencida');
  const ausentes = certidoes.filter((c) => c.situacao === 'ausente');
  const enviaveis = certidoes.filter(podeEnviar);

  const montar = async (formato: 'zip' | 'pdf') => {
    if (!empresaAtiva?.id) return;
    setGerando(formato);
    try {
      const { data: empresa } = await supabase
        .from('empresas').select('*').eq('id', empresaAtiva.id).maybeSingle();
      const contaEscolhida = contas.find((c) => c.id === contaSel) ?? null;
      const conta = contaEscolhida
        ? { banco_nome: contaEscolhida.banco_nome, agencia: contaEscolhida.agencia, numero_conta: contaEscolhida.conta }
        : null;

      // ── O empenho do recibo, pelas fontes certas ──────────────────────
      //
      // Antes: `pedido.numero_pedido` vestido de empenho — o recibo dizia
      // "NOTA DE EMPENHO nº 001" quando o empenho é 2025NE000064. Recibo se
      // APRESENTA ao órgão; número errado é devolução na certa.
      //
      // 1º o vínculo (quem criou o pedido disse de qual empenho ele sai);
      // 2º as Informações Complementares da própria NF-e; sem nenhum, o
      // recibo omite a menção em vez de inventar.
      // A seleção do diálogo manda (pré-preenchida pelo vínculo/empenho único);
      // sem seleção, resta a leitura das Informações Complementares da NF-e.
      const empenhoDoVinculo: string | null = empenhoSel || null;

      // A escolha feita aqui É o vínculo que faltava (pedidos anteriores a
      // 30/08 nasceram antes da coluna empenho_id): grava no pedido, e o
      // próximo kit pré-seleciona sozinho — e o saldo do empenho passa a
      // contar esta entrega, como manda o desenho.
      const empenhoEscolhido = empenhos.find((e) => e.numero === empenhoSel);
      if (empenhoEscolhido && vinculoOriginal !== empenhoEscolhido.id) {
        const { data: gravado } = await supabase
          .from('contrato_pedidos')
          .update({ empenho_id: empenhoEscolhido.id } as never)
          .eq('id', pedido.id)
          .select('id');
        if (gravado?.length) {
          setVinculoOriginal(empenhoEscolhido.id);
          toast.info(`Vínculo gravado: pedido ${pedido.numero_pedido} sai do empenho ${empenhoEscolhido.numero}.`, {
            description: 'O saldo do empenho passa a contar esta entrega, e o próximo kit já vem pré-selecionado.',
          });
        }
      }
      let infComplementares: string | null = null;
      if (!empenhoDoVinculo) {
        const { data: lanc } = await supabase
          .from('financeiro_lancamentos')
          .select('id')
          .eq('contrato_pedido_id', pedido.id)
          .limit(1)
          .maybeSingle();
        const lancId = (lanc as unknown as { id: string } | null)?.id;
        if (lancId) {
          const { data: doc } = await supabase
            .from('financeiro_documentos_fiscais' as never)
            .select('ocr_data')
            .eq('lancamento_id', lancId)
            .limit(1)
            .maybeSingle();
          const ocr = (doc as unknown as { ocr_data: Record<string, unknown> | null } | null)?.ocr_data;
          const inf = ocr?.['inf_compl'] ?? ocr?.['informacoes_complementares'];
          infComplementares = typeof inf === 'string' ? inf : null;
        }
      }
      const empenhoResolvido = numeroDoEmpenho({
        doVinculo: empenhoDoVinculo,
        textoDaNota: infComplementares,
      });

      const dados: DadosDoRecibo = {
        orgao: contrato.orgao ?? '—',
        valor: Number(pedido.valor_total) || 0,
        notaFiscal: pedido.nota_fiscal ?? null,
        empenho: empenhoResolvido?.numero ?? null,
        remessa,
        numeroContrato: contrato.numero,
      };
      const recibo = gerarReciboPdf(empresa as never, (conta as never) ?? null, dados);

      const { pecas, falhas } = await baixarCertidoes(certidoes);
      const nomeBase = `kit-faturamento-${(pedido.nota_fiscal || pedido.numero_pedido || 'pedido')
        .replace(/[^\w.-]/g, '_')}`;
      const todas = [{ nome: '00-Recibo.pdf', blob: recibo }, ...pecas];

      if (formato === 'zip') {
        const indice = indiceDoKit(certidoes, falhas, [
          `KIT DE FATURAMENTO — ${empresa?.razao_social ?? ''}`,
          `Pedido ${pedido.numero_pedido}${pedido.nota_fiscal ? ` · NF ${pedido.nota_fiscal}` : ''}`,
          `Contrato ${contrato.numero ?? '—'} · ${contrato.orgao ?? '—'}`,
        ]);
        baixar(await montarZip(todas, indice), `${nomeBase}.zip`);
      } else {
        const { blob, ignorados } = await montarPdfUnico(todas);
        baixar(blob, `${nomeBase}.pdf`);
        if (ignorados.length) {
          toast.warning(`Fora do PDF (formato não suportado): ${ignorados.join(', ')}`);
        }
      }

      if (falhas.length) toast.warning(`Não foi possível baixar: ${falhas.join(', ')}`);
      else toast.success('Kit gerado.');
    } catch (e) {
      toast.error('Erro ao montar o kit: ' + (e as Error).message);
    } finally {
      setGerando(null);
    }
  };

  return (
    <>
      {/* Ícone, não rótulo: numa linha de tabela com cinco ações, os 120px
          do texto eram exatamente o que transbordava e cortava os botões
          seguintes. O título no hover mantém a descoberta. */}
      <Button size="icon" variant="outline" className="h-7 w-7"
        title="Kit de faturamento" onClick={() => setAberto(true)}>
        <Package className="w-4 h-4" />
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" /> Kit de faturamento
            </DialogTitle>
            <DialogDescription>
              Recibo de quitação e certidões para acompanhar a NF-e do pedido{' '}
              {pedido.numero_pedido}
              {contrato.numero ? ` · contrato ${contrato.numero}` : ''}
            </DialogDescription>
          </DialogHeader>

          {carregando ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {(vencidas.length > 0 || ausentes.length > 0) && (
                <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-medium text-destructive">
                      {vencidas.length > 0 && `${vencidas.length} certidão(ões) vencida(s)`}
                      {vencidas.length > 0 && ausentes.length > 0 && ' · '}
                      {ausentes.length > 0 && `${ausentes.length} não cadastrada(s)`}
                    </p>
                    <p className="text-muted-foreground">
                      Não entram no pacote. Renove em Jurídico → Documentos antes de enviar ao
                      órgão — certidão vencida volta como pendência e trava o pagamento.
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-border p-3 space-y-2.5">
                <p className="text-xs font-semibold">Recibo — referências que o órgão confere</p>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-xs">Nota de empenho</Label>
                    <Select value={empenhoSel || 'nenhum'} onValueChange={(v) => setEmpenhoSel(v === 'nenhum' ? '' : v)}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">— Sem menção ao empenho —</SelectItem>
                        {empenhos.map((e) => (
                          <SelectItem key={e.id} value={e.numero}>{e.numero}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Conta para recebimento</Label>
                    <Select value={contaSel || 'nenhuma'} onValueChange={(v) => setContaSel(v === 'nenhuma' ? '' : v)}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhuma">— Sem dados bancários —</SelectItem>
                        {contas.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {[c.banco_nome || c.nome, c.agencia && `ag. ${c.agencia}`, c.conta && `c/c ${c.conta}`].filter(Boolean).join(' · ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {contas.length === 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Nenhuma conta com dados bancários no Financeiro → Contas — cadastre banco, agência e conta lá para o recibo carregá-los.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border divide-y divide-border">
                {certidoes.map((c) => (
                  <div key={c.nome} className="flex items-center gap-2 p-2.5 text-xs">
                    <span className="flex-1 min-w-0 truncate">{c.nome}</span>
                    {c.documento?.validade && (
                      <span className="text-muted-foreground tabular-nums whitespace-nowrap">
                        {new Date(c.documento.validade.slice(0, 10) + 'T12:00:00')
                          .toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    <Badge variant="outline" className={`text-xs ${CORES[c.situacao]}`}>
                      {ROTULOS[c.situacao]}
                    </Badge>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                O pacote leva o recibo de quitação mais {enviaveis.length} certidão(ões).
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAberto(false)}>Fechar</Button>
            <Button variant="outline" disabled={!!gerando || carregando} onClick={() => montar('zip')}>
              {gerando === 'zip' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                 : <FileArchive className="w-3.5 h-3.5 mr-1.5" />}
              Baixar ZIP
            </Button>
            <Button disabled={!!gerando || carregando} onClick={() => montar('pdf')}>
              {gerando === 'pdf' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                 : <FileText className="w-3.5 h-3.5 mr-1.5" />}
              Baixar PDF único
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
