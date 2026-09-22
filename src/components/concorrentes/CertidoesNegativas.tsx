import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Shield, ExternalLink, Loader2, AlertTriangle, CheckCircle2, AlertCircle, HelpCircle, MapPin, Building2,
  Landmark, FolderLock, Mail, Download, FileCheck2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadCSV } from '@/lib/download-utils';
import { REGIOES_ESTADOS } from '@/data/regioes-brasil';
import {
  checklistDeCertidoes, cidadeDaLista, modeloDeSolicitacao, orgaoCadastradoDoMunicipio, porEsfera, ROTULO_DA_ESFERA,
  ROTULO_DA_OBTENCAO, validadeLegivel,
  type CertidaoDoCatalogo,
} from '@/data/certidoes-catalogo';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useOrgaosDaEmpresa } from '@/hooks/useOrgaosDaEmpresa';
import { AVISO_ORGAOS_INDISPONIVEIS, linhaDoOrgao, type DadosDoOrgao } from '@/lib/documentos/orgaos-da-empresa';
import DialogOrgaoEmissor from '@/components/documentos/DialogOrgaoEmissor';

/**
 * Certidões — cada uma no seu órgão emissor (22/09/2026, tarde).
 *
 * O que esta aba fazia: "emitia" certidões por raspagem com IA nos sites do
 * TST, da Caixa e da Receita (todos com verificação humana, logo nada saía),
 * pedia à IA uma lista genérica de certidões estaduais e municipais sem
 * saber onde a empresa está (a prefeitura de São Paulo para um CNPJ de
 * Belém), e resumia tudo em prosa. O dono: "quem atua dentro da
 * administração pública busca por veracidade, documentos probatórios reais".
 *
 * O que ela faz agora, e só:
 *  1. lê o CADASTRO do CNPJ na base da Receita — o domicílio fiscal decide os
 *     órgãos estadual e municipal, não uma seleção solta;
 *  2. consulta as SANÇÕES nos quatro cadastros do Portal da Transparência,
 *     pela API oficial, com o filtro conferido;
 *  3. mostra o CHECKLIST do domicílio: para cada certidão da Lei 14.133,
 *     quem emite, onde, como se obtém, quanto tempo vale e se um terceiro
 *     consegue consultar. Nenhuma certidão é gerada aqui: a válida é o PDF do
 *     órgão, e o cofre de Documentos guarda, lê a validade e avisa.
 */
type ResultadoCadastro = {
  nome: string; status: 'limpo' | 'encontrado' | 'erro'; registros: Array<Record<string, unknown>>; total: number; erro?: string; url: string;
};
type Idoneidade = {
  ceis: ResultadoCadastro; cnep: ResultadoCadastro; cepim: ResultadoCadastro; leniencia: ResultadoCadastro;
  idonea: boolean; inconclusiva: boolean; divergencias: string[];
};
type Cadastro = {
  razaoSocial: string; nomeFantasia: string; situacao: string; motivoSituacao: string; dataAbertura: string;
  uf: string; municipio: string; cnaePrincipal: string; porte: string;
};
type Resultado = {
  cnpj: string; cadastro: Cadastro | null; cadastroErro?: string; idoneidade: Idoneidade | null; idoneidadeErro?: string; consultadoEm: string;
};

const s = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

/** Uma linha por registro de sanção: tipo · órgão · processo · período. */
function resumoDoRegistro(reg: Record<string, unknown>): string {
  const orgao = s(obj(reg.orgaoSancionador).nome) || s(obj(reg.orgaoSuperior).nome) || s(reg.orgaoResponsavel);
  const tipo = s(obj(reg.tipoSancao).descricaoResumida) || s(obj(reg.tipoSancao).descricaoPortal) || s(reg.tipoSancao);
  const processo = s(reg.numeroProcesso);
  const inicio = s(reg.dataInicioSancao);
  const fim = s(reg.dataFimSancao);
  return [tipo, orgao, processo ? `processo ${processo}` : '', inicio ? `de ${inicio}${fim ? ` a ${fim}` : ''}` : ''].filter(Boolean).join(' · ');
}

const formatarCnpj = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

const ESTADO_DO_CADASTRO = {
  limpo: { rotulo: 'Nenhum registro', icone: CheckCircle2, tinta: 'text-success-ink', caixa: 'border-success-line bg-success-tint' },
  encontrado: { rotulo: 'Registro encontrado', icone: AlertCircle, tinta: 'text-destructive-ink', caixa: 'border-destructive-line bg-destructive-tint' },
  erro: { rotulo: 'Sem resposta', icone: HelpCircle, tinta: 'text-warning-ink', caixa: 'border-warning-line bg-warning-tint' },
} as const;

export default function CertidoesNegativas() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [cnpjInput, setCnpjInput] = useState('');
  const [uf, setUf] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<Resultado | null>(null);

  // O órgão municipal que a empresa ativa cadastrou para município fora do
  // mapa (fase 2, entrega c): entra na mescla do catálogo. Tabela ausente é
  // aviso discreto no diálogo, não alarme na aba.
  const {
    orgaos: orgaosDaEmpresa, erro: erroDosOrgaos, indisponivel: orgaosIndisponiveis, salvar: salvarOrgao,
  } = useOrgaosDaEmpresa(empresaAtiva?.id ?? null);
  const [dialogoOrgao, setDialogoOrgao] = useState(false);
  const [salvandoOrgao, setSalvandoOrgao] = useState(false);
  const [erroOrgao, setErroOrgao] = useState<string | null>(null);

  const ufs = useMemo(() => {
    const lista: { uf: string; nome: string }[] = [];
    Object.values(REGIOES_ESTADOS).forEach((r) => r.estados.forEach((e) => lista.push({ uf: e.uf, nome: e.nome })));
    return lista.sort((a, b) => a.nome.localeCompare(b.nome));
  }, []);
  const cidades = useMemo(() => {
    if (!uf) return [];
    for (const r of Object.values(REGIOES_ESTADOS)) {
      const e = r.estados.find((x) => x.uf === uf);
      if (e) return [...(e.cidades ?? [])].sort();
    }
    return [];
  }, [uf]);

  const checklist = useMemo(
    () => checklistDeCertidoes(uf || null, municipio || null, orgaosDaEmpresa),
    [uf, municipio, orgaosDaEmpresa],
  );
  const grupos = useMemo(() => porEsfera(checklist), [checklist]);
  const razaoSocial = resultado?.cadastro?.razaoSocial || '';
  const cnpjLegivel = formatarCnpj(cnpjInput.replace(/\D/g, ''));
  /** O cadastro da empresa para o município escolhido, se houver — para corrigir. */
  const orgaoCadastrado = useMemo(
    () => (uf && municipio ? orgaoCadastradoDoMunicipio(uf, municipio, orgaosDaEmpresa) : null),
    [uf, municipio, orgaosDaEmpresa],
  );

  const abrirCadastroDoOrgao = () => {
    setErroOrgao(null);
    setDialogoOrgao(true);
  };

  /** Grava (ou corrige) o órgão do município escolhido, para a empresa ativa. */
  const confirmarOrgao = async (dados: DadosDoOrgao) => {
    if (!user || !empresaAtiva || !uf || !municipio) return;
    setSalvandoOrgao(true);
    setErroOrgao(null);
    const r = await salvarOrgao(
      linhaDoOrgao(dados, { empresaId: empresaAtiva.id, userId: user.id, uf, municipio }),
      orgaoCadastrado?.id,
    );
    setSalvandoOrgao(false);
    if (!r.ok) { setErroOrgao(r.erro ?? 'erro desconhecido'); return; }
    setDialogoOrgao(false);
    toast.success(`Órgão de ${municipio}/${uf} ${orgaoCadastrado ? 'corrigido' : 'cadastrado'} para ${empresaAtiva.nome_fantasia || empresaAtiva.razao_social}.`);
  };

  const consultar = async () => {
    const cnpj = cnpjInput.replace(/\D/g, '');
    if (cnpj.length !== 14) { setErro('CNPJ deve conter 14 dígitos'); return; }
    setErro('');
    setLoading(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke('certidoes-negativas', { body: { cnpj } });
      if (error) throw error;
      if (data?.error) { setErro(String(data.error)); return; }
      const r = data as Resultado;
      setResultado(r);
      // O domicílio fiscal vem do cadastro: a UF e o município da Receita,
      // escritos como o seletor escreve. Quem quiser outro (filial) troca.
      if (r.cadastro?.uf) {
        setUf(r.cadastro.uf);
        setMunicipio(cidadeDaLista(r.cadastro.uf, r.cadastro.municipio) ?? r.cadastro.municipio);
      }
      const idon = r.idoneidade;
      if (idon) toast.success(idon.inconclusiva ? 'Consulta feita; uma fonte não respondeu.' : idon.idonea ? 'Sem sanções nos quatro cadastros.' : 'Há registro de sanção: veja abaixo.');
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao consultar');
    } finally {
      setLoading(false);
    }
  };

  const exportar = () => {
    downloadCSV(
      `certidoes-${uf || 'federal'}${municipio ? `-${municipio}` : ''}`,
      ['Esfera', 'Certidão', 'Vaga no cofre', 'Emissor', 'Fundamento', 'Validade usual', 'Como se obtém', 'Terceiro consulta', 'Endereço'],
      checklist.map((c) => [ROTULO_DA_ESFERA[c.esfera], c.nome, c.vaga ?? '', c.emissor, c.fundamento, validadeLegivel(c.validadeDias), ROTULO_DA_OBTENCAO[c.obtencao], c.terceiroConsulta ? 'sim' : 'não', c.urlEmissao ?? '']),
    );
    toast.success('Checklist exportado.');
  };

  const idon = resultado?.idoneidade ?? null;
  const cadastros: Array<{ chave: keyof Pick<Idoneidade, 'ceis' | 'cnep' | 'cepim' | 'leniencia'>; nome: string }> = [
    { chave: 'ceis', nome: 'CEIS — inidôneas e suspensas' },
    { chave: 'cnep', nome: 'CNEP — empresas punidas' },
    { chave: 'cepim', nome: 'CEPIM — entidades impedidas' },
    { chave: 'leniencia', nome: 'Acordos de leniência' },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
          <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Certidões — cada uma no seu órgão emissor
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          As sanções são consultadas na fonte, pelo Portal da Transparência. As certidões de regularidade saem nos órgãos
          que as emitem, para o domicílio fiscal do CNPJ; o Praefectus não gera certidão. O PDF do órgão vai para o cofre
          de Documentos, que lê a validade e avisa antes de vencer.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
            <Label htmlFor="certidoes-cnpj">CNPJ</Label>
            <Input id="certidoes-cnpj" placeholder="Ex.: 12.345.678/0001-01" value={cnpjInput} inputMode="numeric"
              aria-invalid={erro ? true : undefined} onChange={(e) => setCnpjInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && consultar()} />
          </div>
          <Button onClick={consultar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? 'Consultando…' : 'Consultar'}
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="certidoes-uf">Domicílio fiscal — UF</Label>
            <Select value={uf} onValueChange={(v) => { setUf(v); setMunicipio(''); }}>
              <SelectTrigger id="certidoes-uf">
                <MapPin className="mr-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <SelectValue placeholder="Vem do cadastro do CNPJ, ou escolha" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {ufs.map((e) => <SelectItem key={e.uf} value={e.uf}>{e.uf} — {e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="certidoes-municipio">Domicílio fiscal — município</Label>
            <Select value={municipio} onValueChange={setMunicipio} disabled={!uf}>
              <SelectTrigger id="certidoes-municipio">
                <Building2 className="mr-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <SelectValue placeholder={uf ? 'Escolha o município' : 'Escolha a UF primeiro'} />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                {municipio && !cidades.includes(municipio) && <SelectItem value={municipio}>{municipio}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>

        {resultado?.cadastro && (
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{resultado.cadastro.razaoSocial}</span>
            {' · '}situação cadastral {resultado.cadastro.situacao || '—'}
            {' · '}domicílio {resultado.cadastro.municipio}/{resultado.cadastro.uf} (Receita Federal)
          </p>
        )}
        {resultado?.cadastroErro && <p className="mt-3 text-sm text-warning-ink">{resultado.cadastroErro}</p>}

        {erro && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}
      </Card>

      {loading && (
        <Card role="status" aria-busy="true" className="p-5">
          <p className="flex items-center gap-2 text-base text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
            Lendo o cadastro na Receita e os cadastros de sanções no Portal da Transparência…
          </p>
          <div aria-hidden="true" className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </Card>
      )}

      {resultado && !loading && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
              <Landmark className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Sanções e impedimentos — Portal da Transparência
            </h3>
            {idon && (
              <Badge variant={idon.inconclusiva ? 'warning' : idon.idonea ? 'success' : 'danger'}>
                {idon.inconclusiva ? 'Inconclusiva' : idon.idonea ? 'Sem sanções' : 'Com restrições'}
              </Badge>
            )}
          </div>
          {resultado.idoneidadeErro && !idon && (
            <p className="mt-2 text-sm text-warning-ink">Sem resposta do Portal da Transparência: {resultado.idoneidadeErro}</p>
          )}
          {idon && (
            <>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {cadastros.map(({ chave, nome }) => {
                  const r = idon[chave];
                  const cfg = ESTADO_DO_CADASTRO[r.status] ?? ESTADO_DO_CADASTRO.erro;
                  const Icone = cfg.icone;
                  return (
                    <div key={chave} className={`rounded-md border p-3 ${cfg.caixa}`}>
                      <div className="flex items-center gap-2">
                        <Icone className={`h-4 w-4 shrink-0 ${cfg.tinta}`} aria-hidden="true" />
                        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{nome}</p>
                      </div>
                      <p className={`mt-1 text-xs font-medium ${cfg.tinta}`}>{cfg.rotulo}{r.status === 'encontrado' ? ` (${r.total})` : ''}</p>
                      {r.status === 'encontrado' && (
                        <ul className="mt-1 space-y-1 text-xs text-foreground">
                          {r.registros.slice(0, 3).map((reg, i) => <li key={i}>{resumoDoRegistro(reg) || 'registro sem detalhe legível'}</li>)}
                        </ul>
                      )}
                      {r.status === 'erro' && <p className="mt-1 text-xs text-muted-foreground">{r.erro}</p>}
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" aria-hidden="true" /> Conferir no portal
                      </a>
                    </div>
                  );
                })}
              </div>
              {idon.divergencias.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-warning-ink">
                  {idon.divergencias.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Fonte: API do Portal da Transparência (CGU), consultada em {new Date(resultado.consultadoEm).toLocaleString('pt-BR')}. O detalhe de cada registro está na aba Idoneidade.
              </p>
            </>
          )}
        </Card>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 grow basis-56">
            <h3 className="flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
              <FileCheck2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Certidões de regularidade — onde cada uma se emite
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {uf
                ? `Federais, ${uf}${municipio ? ` e ${municipio}` : ''}: quem emite, como se obtém e quanto vale. Guarde o PDF do órgão em Documentos.`
                : 'Federais valem para qualquer CNPJ. Consulte o CNPJ ou escolha a UF e o município para ver as estaduais e municipais.'}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/documentos"><FolderLock className="h-4 w-4" aria-hidden="true" /> Cofre de Documentos</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={exportar}><Download className="h-4 w-4" aria-hidden="true" /> Exportar checklist</Button>
          </div>
        </div>

        <div className="mt-4 space-y-5">
          {grupos.map((g) => (
            <section key={g.esfera} aria-labelledby={`esfera-${g.esfera}`}>
              <h4 id={`esfera-${g.esfera}`} className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {ROTULO_DA_ESFERA[g.esfera]}{g.esfera === 'estadual' && uf ? ` — ${uf}` : ''}{g.esfera === 'municipal' && municipio ? ` — ${municipio}` : ''}
              </h4>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {g.certidoes.map((c) => (
                  <CartaoDaCertidao
                    key={c.id}
                    c={c}
                    razaoSocial={razaoSocial}
                    cnpj={cnpjLegivel}
                    aoCadastrarOrgao={empresaAtiva ? abrirCadastroDoOrgao : undefined}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {erroDosOrgaos && (
          <p className="mt-3 text-xs text-warning-ink">Não foi possível ler os órgãos cadastrados pela empresa: {erroDosOrgaos}</p>
        )}
        {!empresaAtiva && checklist.some((c) => c.pendenteDeCadastro && c.esfera === 'municipal') && (
          <p className="mt-3 text-xs text-muted-foreground">
            Município fora do mapa: escolha uma empresa na faixa superior para cadastrar o órgão dela.
          </p>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          A validade "usual" é a regra geral do órgão; a que vale é a impressa no documento, que o cofre lê do PDF.
          Os sites dos órgãos exigem a verificação "sou humano": a emissão é feita por quem consulta, nunca por robô.
        </p>
      </Card>

      {dialogoOrgao && uf && municipio && (
        <DialogOrgaoEmissor
          aberto
          aoFechar={() => setDialogoOrgao(false)}
          uf={uf}
          municipio={municipio}
          existente={orgaoCadastrado}
          salvando={salvandoOrgao}
          erro={erroOrgao}
          indisponivel={orgaosIndisponiveis ? AVISO_ORGAOS_INDISPONIVEIS : null}
          aoConfirmar={confirmarOrgao}
        />
      )}
    </div>
  );
}

function CartaoDaCertidao({ c, razaoSocial, cnpj, aoCadastrarOrgao }: {
  c: CertidaoDoCatalogo; razaoSocial: string; cnpj: string; aoCadastrarOrgao?: () => void;
}) {
  const solicitacao = c.obtencao === 'solicitacao'
    ? modeloDeSolicitacao({ certidao: c.nome, orgao: c.emissor, razaoSocial: razaoSocial || '(razão social)', cnpj: cnpj || '(CNPJ)', para: c.emailSolicitacao })
    : null;
  // Município fora do mapa: a empresa cadastra o órgão dela; cadastrado, pode corrigir.
  const podeCadastrar = c.esfera === 'municipal' && c.pendenteDeCadastro && Boolean(aoCadastrarOrgao);
  const podeEditar = c.cadastradoPelaEmpresa && Boolean(aoCadastrarOrgao);
  return (
    <article className="flex flex-col rounded-md border border-border p-4">
      <h5 className="text-sm font-semibold leading-5 text-foreground">{c.sigla && c.sigla !== c.nome ? `${c.sigla} · ` : ''}{c.nome}</h5>
      <p className="mt-1 text-xs text-muted-foreground">{c.emissor}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
        <dt className="text-muted-foreground">Fundamento</dt><dd className="text-foreground">{c.fundamento}</dd>
        <dt className="text-muted-foreground">Validade usual</dt><dd className="text-foreground">{validadeLegivel(c.validadeDias)}</dd>
        <dt className="text-muted-foreground">Como se obtém</dt><dd className="text-foreground">{ROTULO_DA_OBTENCAO[c.obtencao]}</dd>
        <dt className="text-muted-foreground">Terceiro consulta</dt><dd className="text-foreground">{c.terceiroConsulta ? 'sim, só com o CNPJ' : 'não'}</dd>
      </dl>
      {c.observacao && <p className="mt-2 text-xs text-muted-foreground">{c.observacao}</p>}
      {c.pendenteDeCadastro && <Badge variant="warning" className="mt-2 w-fit">Órgão a cadastrar</Badge>}
      {c.cadastradoPelaEmpresa && <Badge variant="info" className="mt-2 w-fit">Órgão informado pela empresa</Badge>}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {podeCadastrar && (
          <button type="button" onClick={aoCadastrarOrgao} className="inline-flex items-center gap-1 text-primary hover:underline">
            <Building2 className="h-3 w-3" aria-hidden="true" /> Cadastrar órgão
          </button>
        )}
        {podeEditar && (
          <button type="button" onClick={aoCadastrarOrgao} className="inline-flex items-center gap-1 text-primary hover:underline">
            <Building2 className="h-3 w-3" aria-hidden="true" /> Editar órgão
          </button>
        )}
        {c.urlEmissao && (
          <a href={c.urlEmissao} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            <ExternalLink className="h-3 w-3" aria-hidden="true" /> {c.obtencao === 'consulta_api' ? 'Consultar no portal' : 'Emitir no órgão'}
          </a>
        )}
        {c.urlAutenticidade && c.urlAutenticidade !== c.urlEmissao && (
          <a href={c.urlAutenticidade} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            <ExternalLink className="h-3 w-3" aria-hidden="true" /> Conferir autenticidade
          </a>
        )}
        {solicitacao && (
          <a href={solicitacao.mailto} className="inline-flex items-center gap-1 text-primary hover:underline">
            <Mail className="h-3 w-3" aria-hidden="true" /> Preparar e-mail de solicitação
          </a>
        )}
      </div>
    </article>
  );
}
