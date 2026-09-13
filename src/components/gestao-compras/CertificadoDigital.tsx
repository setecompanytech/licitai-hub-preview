import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import TabelaGestao, { type ColunaGestao } from '@/components/gestao/TabelaGestao';
import ListaDeCampos, { BlocoDoPainel } from '@/components/gestao/ListaDeCampos';
import SeloSituacao, { ValorIndisponivel, type TomSituacao } from '@/components/gestao/SeloSituacao';
import { SecaoGestao } from '@/components/gestao/TelaGestao';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  ShieldCheck, Upload, Eye, EyeOff, Loader2, Trash2, Key, HardDrive, FileSignature,
} from 'lucide-react';

// Espelho de public.certificados_digitais (migration de 07/07). As três
// colunas de identificação do titular existem desde o começo e ficavam SEMPRE
// nulas: o envio gravava só empresa_id/tipo/storage_path/ativo. É por isso que
// o selo de validade dizia "Válido" para todo mundo — comparava uma data nula.
type Certificado = {
  id: string;
  tipo: 'A1' | 'A3';
  nome_titular: string | null;
  cnpj_titular: string | null;
  validade: string | null;
  ativo: boolean;
  storage_path: string | null;
  created_at: string;
  updated_at: string | null;
};

const hojeISO = () => new Date().toISOString().slice(0, 10);
const fmtData = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR') : '—';
const fmtCarimbo = (ts: string | null) =>
  ts ? new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/**
 * Situação do certificado — e a razão de ela poder ser "não informada".
 *
 * O arquivo .pfx é cifrado com a senha do titular, e a senha NÃO é armazenada
 * (é usada só no momento da assinatura). Sem ela, o app não consegue abrir o
 * PKCS#12 para ler titular, CNPJ e data de validade. Então a validade só existe
 * quando alguém a informa no envio — e, quando não existe, a tela diz isso em
 * vez de afirmar "Válido", que era uma mentira sobre um campo nulo.
 */
function situacaoDoCertificado(cert: Certificado): { tom: TomSituacao; texto: string; explicacao: string } {
  if (!cert.validade) {
    return {
      tom: 'indisponivel',
      texto: 'Validade não informada',
      explicacao: 'O sistema não lê o arquivo .pfx (a senha não é armazenada). Informe a validade ao enviar para acompanhar o vencimento.',
    };
  }
  const hoje = hojeISO();
  if (cert.validade < hoje) {
    return { tom: 'critico', texto: `Vencido em ${fmtData(cert.validade)}`, explicacao: 'Assinaturas com este certificado serão recusadas.' };
  }
  const dias = Math.ceil((new Date(`${cert.validade}T00:00:00`).getTime() - new Date(`${hoje}T00:00:00`).getTime()) / 86400000);
  if (dias <= 30) {
    return { tom: 'atencao', texto: `Vence em ${dias} dia${dias === 1 ? '' : 's'}`, explicacao: `Validade informada: ${fmtData(cert.validade)}.` };
  }
  return { tom: 'sucesso', texto: `Válido até ${fmtData(cert.validade)}`, explicacao: 'Validade informada no envio.' };
}

/** Uma linha da Atividade recente. Só eventos que a tabela realmente registra. */
type Atividade = {
  id: string;
  quando: string;
  evento: string;
  certificado: string;
  detalhe: string;
};

const defaultForm = () => ({ nome_titular: '', cnpj_titular: '', validade: '' });

export default function CertificadoDigital() {
  const { empresaAtiva } = useEmpresa();
  const [certs, setCerts] = useState<Certificado[]>([]);
  const [loading, setLoading] = useState(false);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [uploading, setUploading] = useState(false);
  const [aExcluir, setAExcluir] = useState<Certificado | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Princípio 3 do CLAUDE.md: falha silenciosa é proibida. Antes, o erro do
  // select era descartado e a tela mostrava "nenhum certificado cadastrado" —
  // indistinguível de uma empresa que de fato não tem certificado.
  const loadCerts = useCallback(async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('certificados_digitais' as never)
      .select('*')
      .eq('empresa_id', empresaAtiva.id)
      .order('created_at', { ascending: false });
    if (error) {
      setErroCarga(error.message);
      setCerts([]);
    } else {
      setErroCarga(null);
      setCerts((data ?? []) as Certificado[]);
    }
    setLoading(false);
  }, [empresaAtiva]);

  useEffect(() => { void loadCerts(); }, [loadCerts]);

  function fecharEnvio() {
    setUploadOpen(false);
    setFile(null);
    setSenha('');
    setForm(defaultForm());
  }

  async function handleUpload() {
    if (!file || !empresaAtiva) return;
    if (!senha.trim()) { toast.error('Informe a senha do certificado'); return; }
    setUploading(true);
    try {
      const path = `${empresaAtiva.id}/certificados/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from('certificados-digitais')
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      // As três colunas de identificação passam a ser gravadas. Elas vêm do
      // formulário, não do .pfx: sem a senha em claro não há como abrir o
      // PKCS#12, e a senha continua não sendo armazenada. Em branco, ficam
      // nulas — e a tela diz "não informada" em vez de inventar um estado.
      const { error: dbErr } = await supabase
        .from('certificados_digitais' as never)
        .insert({
          empresa_id: empresaAtiva.id,
          tipo: 'A1',
          storage_path: path,
          ativo: true,
          nome_titular: form.nome_titular.trim() || null,
          cnpj_titular: form.cnpj_titular.trim() || null,
          validade: form.validade || null,
        } as never);
      if (dbErr) throw dbErr;

      toast.success('Certificado A1 enviado');
      fecharEnvio();
      void loadCerts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'verifique o arquivo';
      toast.error('Erro ao enviar certificado', { description: msg });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(cert: Certificado) {
    setExcluindo(true);
    if (cert.storage_path) {
      const { error } = await supabase.storage.from('certificados-digitais').remove([cert.storage_path]);
      // O arquivo pode já não existir; o registro ainda precisa sair.
      if (error) toast.warning('Arquivo não removido do armazenamento', { description: error.message });
    }
    const { error } = await supabase.from('certificados_digitais' as never).delete().eq('id', cert.id);
    setExcluindo(false);
    setAExcluir(null);
    if (error) { toast.error('Não foi possível remover', { description: error.message }); return; }
    toast.success('Certificado removido');
    void loadCerts();
  }

  const certsA1 = certs.filter(c => c.tipo !== 'A3');
  const certsA3 = certs.filter(c => c.tipo === 'A3');
  const ativo = certs.find(c => c.ativo) ?? null;
  const situacaoAtivo = ativo ? situacaoDoCertificado(ativo) : null;

  // Atividade recente — montada com o que a tabela guarda de verdade:
  // created_at (envio) e updated_at (alteração posterior). Não há registro de
  // assinatura no banco, então nenhuma linha de "NFS-e assinada" é exibida:
  // seria uma afirmação sem lastro.
  const atividades: Atividade[] = certs
    .flatMap<Atividade>(c => {
      const nome = c.nome_titular ?? `Certificado ${c.tipo}`;
      const linhas: Atividade[] = [{
        id: `${c.id}-envio`,
        quando: c.created_at,
        evento: 'Certificado enviado',
        certificado: nome,
        detalhe: c.storage_path ? c.storage_path.split('/').pop() ?? '—' : 'Sem arquivo',
      }];
      if (c.updated_at && c.updated_at > c.created_at) {
        linhas.push({
          id: `${c.id}-alteracao`,
          quando: c.updated_at,
          evento: 'Cadastro alterado',
          certificado: nome,
          detalhe: c.ativo ? 'Ativo' : 'Inativo',
        });
      }
      return linhas;
    })
    .sort((a, b) => (a.quando < b.quando ? 1 : -1));

  const colunasAtividade: ColunaGestao<Atividade>[] = [
    { chave: 'quando', titulo: 'Quando', render: a => fmtCarimbo(a.quando), largura: '10rem' },
    { chave: 'evento', titulo: 'Evento', render: a => <span className="font-medium">{a.evento}</span> },
    { chave: 'certificado', titulo: 'Certificado', render: a => a.certificado, prioridade: 'desktop' },
    {
      chave: 'detalhe', titulo: 'Detalhe', prioridade: 'desktop',
      render: a => <span className="text-muted-foreground">{a.detalhe}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* ── Envio do A1 ───────────────────────────────────────── */}
      <Dialog open={uploadOpen} onOpenChange={o => { if (!o) fecharEnvio(); else setUploadOpen(true); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Adicionar certificado A1
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <Alert variant="info">
              <AlertDescription>
                O arquivo <strong>.pfx</strong> ou <strong>.p12</strong> guarda o certificado A1. Ele fica
                no armazenamento privado da empresa e é usado para assinar o XML enviado à Prefeitura.
              </AlertDescription>
            </Alert>

            <div>
              <Label>Arquivo do certificado (.pfx / .p12)</Label>
              <button
                type="button"
                className="g-corpo mt-1 w-full rounded-[var(--g-raio)] border-2 border-dashed border-border p-4 text-center transition-colors hover:border-primary hover:bg-primary-tint"
                onClick={() => fileRef.current?.click()}
              >
                {file
                  ? <span className="font-medium text-foreground">{file.name}</span>
                  : (
                    <span className="flex flex-col items-center gap-1">
                      <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                      <span className="g-meta text-muted-foreground">Clique para selecionar</span>
                    </span>
                  )}
              </button>
              <input ref={fileRef} type="file" accept=".pfx,.p12" className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>

            <div>
              <Label htmlFor="cert-senha">Senha do certificado</Label>
              <div className="relative mt-1">
                <Input
                  id="cert-senha"
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="g-controle pr-10"
                />
                <Button type="button" variant="ghost" size="sm" aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 px-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSenha(v => !v)}>
                  {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="g-meta mt-1 text-muted-foreground">
                A senha não é armazenada — é usada apenas no momento da assinatura.
              </p>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <div>
                <p className="g-corpo font-semibold text-foreground">Identificação do certificado</p>
                <p className="g-meta text-muted-foreground">
                  Opcional, e digitado por você: como a senha não é guardada, o sistema não abre o .pfx
                  para ler estes dados. Sem a validade aqui, a tela não consegue avisar do vencimento.
                </p>
              </div>
              <div>
                <Label htmlFor="cert-titular">Titular</Label>
                <Input id="cert-titular" className="g-controle mt-1" value={form.nome_titular}
                  onChange={e => setForm(f => ({ ...f, nome_titular: e.target.value }))}
                  placeholder="Razão social do titular" />
              </div>
              <div>
                <Label htmlFor="cert-cnpj">CNPJ do titular</Label>
                <Input id="cert-cnpj" className="g-controle mt-1" value={form.cnpj_titular}
                  onChange={e => setForm(f => ({ ...f, cnpj_titular: e.target.value }))}
                  placeholder="00.000.000/0001-00" />
              </div>
              <div>
                <Label htmlFor="cert-validade">Válido até</Label>
                <Input id="cert-validade" type="date" className="g-controle mt-1" value={form.validade}
                  onChange={e => setForm(f => ({ ...f, validade: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="outline" onClick={fecharEnvio}>Cancelar</Button>
            <Button disabled={!file || !senha || uploading} onClick={handleUpload}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Enviar certificado
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!aExcluir} onOpenChange={o => { if (!o) setAExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este certificado?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-foreground">
                  {aExcluir?.nome_titular ?? `Certificado ${aExcluir?.tipo ?? 'A1'}`}
                </p>
                <p>
                  O arquivo sai do armazenamento e o cadastro é apagado. Enquanto não houver outro
                  certificado ativo, a assinatura de NFS-e fica sem chave. Não há como desfazer.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={excluindo}
              onClick={() => aExcluir && handleDelete(aExcluir)}
            >
              Remover certificado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {erroCarga && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1">Não foi possível carregar os certificados: {erroCarga}</span>
            <Button size="sm" variant="outline" onClick={() => void loadCerts()}>Tentar novamente</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Os dois cartões (A1 · A3) e o painel de uso ────────── */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_var(--g-painel)]">
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {/* A1 — arquivo, é o que esta tela administra */}
          <section className="g-cartao flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="g-titulo-secao flex items-center gap-2 text-foreground">
                  <ShieldCheck className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Certificado A1
                </h3>
                <p className="g-meta text-muted-foreground">Arquivo .pfx guardado na empresa</p>
              </div>
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4" /> Adicionar A1
              </Button>
            </div>

            {loading ? (
              <div role="status" aria-busy="true" className="space-y-2">
                <span className="sr-only">Carregando</span>
                <Skeleton className="h-16 rounded-[var(--g-raio)]" />
                <Skeleton className="h-16 rounded-[var(--g-raio)]" />
              </div>
            ) : certsA1.length === 0 ? (
              <EstadoVazio
                tamanho="compacto"
                icone={<ShieldCheck />}
                titulo="Nenhum A1 cadastrado"
                descricao="Envie o arquivo .pfx para assinar NFS-e a partir daqui."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {certsA1.map(cert => {
                  const sit = situacaoDoCertificado(cert);
                  return (
                    <li key={cert.id} className="rounded-[var(--g-raio)] border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="g-corpo truncate font-semibold text-foreground">
                            {cert.nome_titular ?? 'Titular não informado'}
                          </p>
                          <p className="g-meta text-muted-foreground">
                            {cert.cnpj_titular ?? 'CNPJ não informado'} · enviado em {fmtCarimbo(cert.created_at)}
                          </p>
                        </div>
                        <Button
                          variant="ghost" size="sm" aria-label={`Remover certificado ${cert.nome_titular ?? cert.tipo}`}
                          className="w-9 shrink-0 px-0" onClick={() => setAExcluir(cert)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <SeloSituacao tom={cert.ativo ? 'ativo' : 'neutro'}>
                          {cert.ativo ? 'Em uso' : 'Inativo'}
                        </SeloSituacao>
                        {/* O selo de validade só aparece com data real; sem ela,
                            a ausência de apuração é declarada, não mascarada. */}
                        {cert.validade
                          ? <SeloSituacao tom={sit.tom} explicacao={sit.explicacao}>{sit.texto}</SeloSituacao>
                          : <ValorIndisponivel razao="Validade não informada" />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* A3 — token físico. O sistema NÃO detecta dispositivo: dizer o
              contrário era o texto anterior ("o sistema irá detectar
              automaticamente"), e nenhuma linha de código fazia isso. */}
          <section className="g-cartao flex flex-col gap-3 p-4">
            <div className="min-w-0">
              <h3 className="g-titulo-secao flex items-center gap-2 text-foreground">
                <HardDrive className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Certificado A3
              </h3>
              <p className="g-meta text-muted-foreground">Token USB ou cartão, fora do Praefectus</p>
            </div>

            <SeloSituacao tom="indisponivel" explicacao="Não há leitura de token neste sistema.">
              Não administrado aqui
            </SeloSituacao>

            <p className="g-corpo text-muted-foreground">
              O A3 vive em hardware e a chave privada não sai dele — não há arquivo para enviar.
              O Praefectus <strong>não</strong> lê token, não verifica dispositivo e não detecta
              quando um está conectado: a assinatura com A3 acontece fora daqui, no programa do
              emissor ou no portal do órgão, com o driver do fabricante instalado na máquina.
            </p>
            <p className="g-corpo text-muted-foreground">
              Para emitir NFS-e por esta tela, cadastre um A1 ao lado.
            </p>

            {certsA3.length > 0 && (
              <ul className="flex flex-col gap-2 border-t border-border pt-3">
                {certsA3.map(cert => (
                  <li key={cert.id} className="flex items-center justify-between gap-2">
                    <span className="g-corpo min-w-0 truncate text-foreground">
                      {cert.nome_titular ?? 'Registro A3'}
                    </span>
                    <Button variant="ghost" size="sm" className="w-9 shrink-0 px-0"
                      aria-label={`Remover registro A3 ${cert.nome_titular ?? ''}`}
                      onClick={() => setAExcluir(cert)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Painel lateral — o que o certificado alimenta hoje */}
        <aside aria-label="Uso e integrações" className="g-cartao flex flex-col gap-4 p-4">
          <BlocoDoPainel titulo="Uso e integrações">
            <ListaDeCampos
              campos={[
                {
                  rotulo: 'Certificado em uso',
                  valor: ativo
                    ? (ativo.nome_titular ?? `Certificado ${ativo.tipo}`)
                    : <ValorIndisponivel razao="Nenhum ativo" />,
                },
                {
                  rotulo: 'Situação',
                  valor: situacaoAtivo && ativo?.validade
                    ? <SeloSituacao tom={situacaoAtivo.tom}>{situacaoAtivo.texto}</SeloSituacao>
                    : <ValorIndisponivel razao="Validade não informada" />,
                },
                { rotulo: 'Tipo', valor: ativo ? ativo.tipo : '—' },
                { rotulo: 'Certificados cadastrados', valor: certs.length, numerico: true },
              ]}
            />
          </BlocoDoPainel>

          <BlocoDoPainel titulo="NFS-e — Prefeitura de Belém">
            <ListaDeCampos
              campos={[
                { rotulo: 'Padrão', valor: 'ISSNET / ABRASF v2' },
                {
                  rotulo: 'Endpoint',
                  largo: true,
                  valor: (
                    <code className="g-meta block break-all font-mono text-muted-foreground">
                      https://www.issdigital.com.br/WsNFe2/LoteRps.jws
                    </code>
                  ),
                },
                { rotulo: 'Papel do certificado', valor: 'Assina o XML do RPS antes do envio', largo: true },
              ]}
            />
          </BlocoDoPainel>

          <BlocoDoPainel titulo="Guarda da senha">
            <p className="g-corpo text-muted-foreground">
              A senha do .pfx não é gravada em lugar nenhum — nem no banco, nem no armazenamento.
              É pedida de novo a cada assinatura. Por isso o sistema também não consegue abrir o
              arquivo para ler titular, CNPJ e validade sozinho.
            </p>
          </BlocoDoPainel>
        </aside>
      </div>

      {/* ── Atividade recente ─────────────────────────────────── */}
      <SecaoGestao titulo="Atividade recente" contagem={atividades.length}>
        <TabelaGestao
          descricao="Eventos registrados dos certificados digitais da empresa"
          colunas={colunasAtividade}
          itens={atividades}
          chaveDoItem={a => a.id}
          carregando={loading}
          vazio={
            <EstadoVazio
              tamanho="compacto"
              icone={<FileSignature />}
              titulo="Nenhuma atividade registrada"
              descricao="Só o envio e a alteração do cadastro deixam rastro no banco. Assinaturas de NFS-e ainda não são registradas — nada aqui é estimado."
            />
          }
        />
      </SecaoGestao>
    </div>
  );
}
