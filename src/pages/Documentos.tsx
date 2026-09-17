import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import ProcessoContextoBanner from '@/components/shared/ProcessoContextoBanner';
import AbasGestao, { type AbaGestao } from '@/components/gestao/AbasGestao';
import AreaComPainel from '@/components/gestao/AreaComPainel';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import TabelaGestao, {
  type ColunaGestao, type OrdenacaoTabela,
} from '@/components/gestao/TabelaGestao';
import { AvisoDeContexto, AvisoDeFalha } from '@/components/gestao/SeloSituacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Download, Eye, FolderOpen, Loader2, MoreHorizontal, PencilLine, Plus,
  Repeat, Trash2, Upload, Users,
} from 'lucide-react';
import MergeDocumentos from '@/components/documentos/MergeDocumentos';
import AtestadosCapacidadeTecnica from '@/components/documentos/AtestadosCapacidadeTecnica';
import AlertasVencimentoEmail from '@/components/documentos/AlertasVencimentoEmail';
import DialogValidade from '@/components/documentos/DialogValidade';
import HistoricoDocumentos from '@/components/documentos/HistoricoDocumentos';
import IndicadoresCofre, { ConformidadeDocumental } from '@/components/documentos/IndicadoresCofre';
import PainelDocumento from '@/components/documentos/PainelDocumento';
import SeloDocumento, { ValidadeDoDocumento } from '@/components/documentos/SeloDocumento';
import {
  FILTROS_DE_SITUACAO, ORDEM_NA_TELA, ROTULO_DO_FILTRO, casaComFiltro, contarCofre,
  montarItensDoCofre, nomeDoArquivo,
  type FiltroSituacao, type ItemDoCofre, type LinhaGravada,
} from '@/components/documentos/item-do-cofre';
import {
  CATEGORIAS_PREVISTAS, VAGAS_PREVISTAS, type CategoriaPrevista,
} from '@/lib/documentos/previstos';
import { diaDaValidade } from '@/lib/documentos/situacao';
import { useAbaNaUrl } from '@/lib/navegacao/aba-na-url';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuthorization } from '@/hooks/useAuthorization';

/* ═══════════════════════════════════════════════════════════════════════════
   O COFRE DE HABILITAÇÃO — reestruturação de 14/09.

   O que esta tela responde, na ordem: "consigo me habilitar hoje?", "o que
   falta?", "onde está o documento X?". As decisões abaixo saíram todas de
   defeitos encontrados na inspeção, e estão escritas aqui porque desfazê-las
   sem saber o motivo é fácil.

   1. A LISTA É DAS VAGAS, NÃO DOS ARQUIVOS. `montarItensDoCofre` parte de
      `VAGAS_PREVISTAS`; a vaga sem arquivo aparece como linha "Ausente". Uma
      tabela alimentada pelo `select` mostraria cofre vazio como tela vazia, e
      é justamente o vazio que precisa ser visto.

   2. "SEM VALIDADE" VIROU O QUINTO INDICADOR, não uma linha de aviso.
      Justificativa: (a) sem ele a aritmética não fecha — previstos = regulares
      + vencidos + ausentes + sem validade, propriedade travada em
      `situacao-documento.test.ts` —, e um total que não bate com as partes
      obriga quem lê a desconfiar do painel inteiro; (b) um aviso em texto não
      entrega o que os outros quatro entregam, que é o CLIQUE para a lista dos
      afetados. O estado nasceu porque estava escondido; escondê-lo de novo
      atrás de uma frase seria repetir o defeito em outro formato.

   3. NÃO HÁ CAIXA DE SELEÇÃO nas linhas. A prévia mostra uma, mas não existe
      nenhuma ação em lote implementada e autorizada nesta tela — exclusão
      passa por RLS linha a linha (dono do anexo ou Admin) e cada envio precisa
      da vaga de destino. Caixa que só marca a linha aberta é controle que
      promete o que não cumpre, e o comando proíbe. Quando houver lote de
      verdade (baixar selecionados como .zip, por exemplo), a coluna entra.

   4. OS INDICADORES CONTAM O CHECKLIST INTEIRO, não o recorte filtrado — se
      seguissem o filtro, clicar em "Vencidos" zeraria os outros quatro e o
      painel viraria eco do próprio clique. A frase abaixo da faixa diz isso.
   ═══════════════════════════════════════════════════════════════════════════ */

type FiltroCategoria = 'todas' | CategoriaPrevista;

/**
 * Chaves de ordenação. Ordenar é APRESENTAÇÃO: nada aqui muda filtro, cálculo
 * ou escrita.
 *
 * Categoria ordena pela posição na LEI (`CATEGORIAS_PREVISTAS`), não pelo
 * alfabeto: "Declarações" antes de "Habilitação Jurídica" inverteria a ordem em
 * que o edital pede os documentos.
 *
 * Validade sem data vai para o fim do crescente (`Infinity`) — "não tem data"
 * não é "vence primeiro".
 */
const CHAVE_ORDENACAO: Record<string, (i: ItemDoCofre) => string | number> = {
  documento: (i) => i.nome.toLowerCase(),
  categoria: (i) => CATEGORIAS_PREVISTAS.indexOf(i.categoria),
  validade: (i) => (i.validade ? diaDaValidade(i.validade).getTime() : Number.POSITIVE_INFINITY),
  situacao: (i) => ORDEM_NA_TELA[i.situacao],
};

const TIPOS_ACEITOS = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const TAMANHO_MAXIMO = 10 * 1024 * 1024;

export default function Documentos() {
  const { user } = useAuth();
  const { empresaAtiva, empresas, todasSelecionadas, setEmpresaAtiva } = useEmpresa();
  // Trilha de auditoria: quem alterou o quê, para o Admin. Hooks no TOPO,
  // SEMPRE — a tela branca de 02/09 veio de hook depois de return.
  const { isCompanyAdmin } = useAuthorization();

  // A aba mora em `?aba=`: assim o Voltar do navegador, o F5 e o link
  // compartilhado caem onde a pessoa estava. Antes era `useState`, e voltar de
  // um documento recomeçava sempre no checklist.
  const [aba, definirAba] = useAbaNaUrl('documentos');

  const [linhas, setLinhas] = useState<LinhaGravada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<FiltroCategoria>('todas');
  const [filtroSituacao, setFiltroSituacao] = useState<FiltroSituacao>('todas');
  const [validadeDe, setValidadeDe] = useState('');
  const [validadeAte, setValidadeAte] = useState('');

  const [selecionadoNome, setSelecionadoNome] = useState<string | null>(null);
  const [ordenacao, setOrdenacao] = useState<OrdenacaoTabela>({ chave: 'situacao', direcao: 'asc' });

  const [enviandoNome, setEnviandoNome] = useState<string | null>(null);
  const [removendoNome, setRemovendoNome] = useState<string | null>(null);
  const [salvandoValidade, setSalvandoValidade] = useState(false);
  const [visualizando, setVisualizando] = useState<{ nome: string; url: string } | null>(null);
  const [aExcluir, setAExcluir] = useState<ItemDoCofre | null>(null);
  const [dialogo, setDialogo] = useState<{ item: ItemDoCofre; arquivo: File | null } | null>(null);

  const inputArquivo = useRef<HTMLInputElement>(null);
  const vagaPendente = useRef<ItemDoCofre | null>(null);
  const controleDeCarga = useRef<AbortController | null>(null);

  /**
   * MODO "TODAS AS EMPRESAS" — o buraco que a tela tinha.
   *
   * `todasSelecionadas` põe `empresaAtiva` em `null`, e a consulta caía no ramo
   * `user_id` puro: o cofre da empresa SUMIA e a tela mostrava 18 vagas
   * ausentes, sem uma palavra explicando. Quem tem duas empresas e nunca
   * escolheu uma ativa (o padrão do `EmpresaContext`) via um cofre vazio e
   * concluía que o sistema tinha perdido os documentos.
   *
   * O cofre é de UMA empresa — o casamento é por nome de vaga, e duas empresas
   * disputariam a mesma linha "Certidão Negativa de Débitos Federais (CND)".
   * Então a tela não adivinha: declara que não apurou e oferece a escolha.
   */
  const modoTodasEmpresas = todasSelecionadas && empresas.length > 0;
  /**
   * Por que não há número a mostrar. Dois casos, e o segundo só apareceu na
   * captura:
   *
   *  - modo "Todas as empresas": o cofre é de uma empresa por vez;
   *  - FALHA DE CARGA: as 18 vagas são constantes e continuam na tela, mas
   *    quais delas têm arquivo veio do banco — e não veio. Dizer "Ausentes: 18"
   *    ali é afirmar sobre dado que não foi lido, e afirmar ausência é tão
   *    falso quanto inventar presença. O comando proíbe substituir erro por
   *    dado; isto é a mesma família.
   */
  const razaoSemApuracao = modoTodasEmpresas
    ? 'Escolha uma empresa — o cofre é de uma empresa por vez'
    : erro
      ? 'Não foi possível ler o cofre — os números voltam quando a carga funcionar'
      : undefined;

  /** Identidade da carga atual: muda quando a empresa muda. */
  const chaveDaEmpresa = modoTodasEmpresas ? 'todas' : (empresaAtiva?.id ?? 'pessoal');

  const carregar = useCallback(async () => {
    if (!user) return;
    if (modoTodasEmpresas) {
      // Nada a consultar: sem empresa definida não existe cofre. Zerar a lista
      // aqui evita mostrar o acervo da empresa anterior sob o aviso.
      setLinhas([]);
      setErro(null);
      setCarregando(false);
      return;
    }

    // Guarda de requisição: a resposta da empresa ANTERIOR pode chegar depois
    // da troca. Sem abortar, os documentos da empresa A apareciam listados sob
    // o nome da empresa B — e nada na tela denunciava a troca.
    controleDeCarga.current?.abort();
    const controle = new AbortController();
    controleDeCarga.current = controle;

    setCarregando(true);
    setErro(null);

    // Documento é DA EMPRESA (princípio nº 2): a régua é a empresa ativa.
    // Linha antiga sem empresa (legado privado) continua visível SÓ para o
    // dono — compartilhar é decisão dele, na tela.
    let consulta = supabase
      .from('documentos')
      .select('id, nome, validade, arquivo_path, empresa_id, user_id, tamanho_bytes, created_at, updated_at, descricao');
    consulta = empresaAtiva
      ? consulta.or(`empresa_id.eq.${empresaAtiva.id},and(user_id.eq.${user.id},empresa_id.is.null)`)
      : consulta.eq('user_id', user.id);

    const { data, error } = await consulta.abortSignal(controle.signal);
    if (controle.signal.aborted) return;

    if (error) {
      // Princípio 3: mensagem real do banco e caminho de volta. Nunca trocar o
      // erro por dado demonstrativo — cofre falso é pior que cofre ilegível.
      setErro(error.message);
      setCarregando(false);
      return;
    }

    // `empresa_id` nasce na migration 20260903000002; o `types.ts` gerado ainda
    // não a conhece — tipagem local, como nas demais colunas novas.
    setLinhas((data ?? []) as unknown as LinhaGravada[]);
    setCarregando(false);
  }, [user, empresaAtiva, modoTodasEmpresas]);

  useEffect(() => {
    carregar();
    return () => controleDeCarga.current?.abort();
  }, [carregar]);

  /* Na troca de empresa, a seleção e o painel morrem: o documento aberto
     pertencia ao cofre anterior, e manter o painel sobre ele mostraria dados de
     uma empresa enquanto a lista já é de outra. Os FILTROS sobrevivem de
     propósito — quem estava caçando vencidos continua caçando vencidos. */
  useEffect(() => {
    setSelecionadoNome(null);
  }, [chaveDaEmpresa]);

  /* Realtime nos DOIS canais, preservado: o anexo do colega tem de aparecer
     aqui sem F5 (é o ponto da conversão para empresa), e a linha pessoal
     legada continua sendo do usuário. */
  useEffect(() => {
    if (!user || modoTodasEmpresas) return;
    const canal = supabase
      .channel(`documentos-realtime-${empresaAtiva?.id ?? user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documentos', filter: `user_id=eq.${user.id}` }, () => carregar());
    if (empresaAtiva) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: 'documentos', filter: `empresa_id=eq.${empresaAtiva.id}` }, () => carregar());
    }
    canal.subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [user, empresaAtiva, modoTodasEmpresas, carregar]);

  const itens = useMemo(() => montarItensDoCofre(linhas), [linhas]);

  const contagem = useMemo(
    () => contarCofre(itens.map((i) => i.situacao), VAGAS_PREVISTAS.length),
    [itens],
  );

  const termo = busca.trim().toLowerCase();

  const filtrados = useMemo(() => itens.filter((i) => {
    if (termo && !i.nome.toLowerCase().includes(termo)) return false;
    if (filtroCategoria !== 'todas' && i.categoria !== filtroCategoria) return false;
    if (!casaComFiltro(i.situacao, filtroSituacao)) return false;
    if (validadeDe || validadeAte) {
      // Recorte por PERÍODO só alcança quem tem data. Item sem validade fica de
      // fora — e o rodapé da tabela diz isso, para a ausência não parecer sumiço.
      if (!i.validade) return false;
      const dia = i.validade.slice(0, 10);
      if (validadeDe && dia < validadeDe) return false;
      if (validadeAte && dia > validadeAte) return false;
    }
    return true;
  }), [itens, termo, filtroCategoria, filtroSituacao, validadeDe, validadeAte]);

  const ordenados = useMemo(() => {
    const extrair = CHAVE_ORDENACAO[ordenacao.chave];
    if (!extrair) return filtrados;
    const sinal = ordenacao.direcao === 'asc' ? 1 : -1;
    return [...filtrados].sort((a, b) => {
      const va = extrair(a);
      const vb = extrair(b);
      if (va === vb) return a.nome.localeCompare(b.nome);
      return va > vb ? sinal : -sinal;
    });
  }, [filtrados, ordenacao]);

  const selecionado = useMemo(
    () => itens.find((i) => i.nome === selecionadoNome) ?? null,
    [itens, selecionadoNome],
  );

  const ausentes = useMemo(() => itens.filter((i) => i.situacao === 'ausente'), [itens]);

  const filtrosAplicados =
    (termo ? 1 : 0) +
    (filtroCategoria !== 'todas' ? 1 : 0) +
    (filtroSituacao !== 'todas' ? 1 : 0) +
    (validadeDe || validadeAte ? 1 : 0);

  const limparFiltros = () => {
    setBusca('');
    setFiltroCategoria('todas');
    setFiltroSituacao('todas');
    setValidadeDe('');
    setValidadeAte('');
  };

  const alternarOrdenacao = (chave: string) => {
    setOrdenacao((atual) => (atual.chave === chave
      ? { chave, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
      : { chave, direcao: 'asc' }));
  };

  // ── Envio de arquivo ──────────────────────────────────────────────────────

  const escolherArquivo = (item: ItemDoCofre) => {
    vagaPendente.current = item;
    inputArquivo.current?.click();
  };

  const aoEscolherArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    const item = vagaPendente.current;
    e.target.value = '';
    if (!arquivo || !item || !user) return;

    if (!TIPOS_ACEITOS.includes(arquivo.type)) {
      toast.error('Formato não suportado. Use PDF, PNG, JPG ou WEBP.');
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }
    setDialogo({ item, arquivo });
  };

  const enviarArquivo = async (item: ItemDoCofre, arquivo: File, validade?: string) => {
    if (!user) return;
    setDialogo(null);
    setEnviandoNome(item.nome);

    const slug = item.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
    const ext = arquivo.name.split('.').pop();
    // Arquivo da empresa vive em empresa/<id>/… — é o que as policies do
    // storage liberam para os colegas. Sem empresa ativa, o caminho pessoal.
    const caminho = empresaAtiva
      ? `empresa/${empresaAtiva.id}/${slug}.${ext}`
      : `${user.id}/${slug}.${ext}`;

    // Remove o arquivo anterior. Pode falhar quando ele mora na pasta pessoal de
    // OUTRO colega (legado) — aí o antigo fica órfão no bucket, o que é
    // aceitável: a linha passa a apontar para o novo.
    if (item.arquivoPath && item.arquivoPath !== caminho) {
      await supabase.storage.from('documentos-habilitacao').remove([item.arquivoPath]);
    }

    const { error: erroUpload } = await supabase.storage
      .from('documentos-habilitacao')
      .upload(caminho, arquivo, { upsert: true });
    if (erroUpload) {
      toast.error('Erro ao enviar: ' + erroUpload.message);
      setEnviandoNome(null);
      return;
    }

    if (item.dbId) {
      /* SUBSTITUIR PRESERVA O ID: é UPDATE na linha existente, nunca
         apagar-e-recriar. O delete é do dono/Admin, e renovar a CRF vencida é
         exatamente a rotina que o colaborador comum precisa fazer.

         ⚠️ `empresa_id` aqui tinha um defeito silencioso: gravava
         `empresaAtiva?.id ?? null` e, SEM empresa ativa, escrevia NULL numa
         linha que já era compartilhada — a equipe inteira perdia o documento
         de vista, sem erro, sem aviso, num gesto que a pessoa fez para
         ATUALIZAR o arquivo. Agora, na falta de empresa ativa, o valor gravado
         é o que já estava lá. Com empresa ativa, a promoção da linha legada
         continua (o documento renovado nasce compartilhado). */
      const { data: atualizadas, error: erroUpdate } = await supabase
        .from('documentos')
        .update({
          arquivo_path: caminho,
          validade: validade ?? null,
          tamanho_bytes: arquivo.size,
          empresa_id: empresaAtiva?.id ?? item.empresaIdGravado ?? null,
        } as never)
        .eq('id', item.dbId)
        .select('id');
      if (erroUpdate || !atualizadas?.length) {
        toast.error('Erro ao atualizar cadastro do documento: '
          + (erroUpdate?.message ?? 'sem permissão para esta linha'));
        setEnviandoNome(null);
        return;
      }
    } else {
      const { error: erroInsert } = await supabase
        .from('documentos')
        .insert({
          user_id: user.id,
          empresa_id: empresaAtiva?.id ?? null,
          nome: item.nome,
          tipo: item.categoria,
          descricao: `${item.categoria} • ${item.artigo}`,
          arquivo_path: caminho,
          validade,
          tamanho_bytes: arquivo.size,
        } as never);
      if (erroInsert) {
        toast.error('Erro ao salvar metadados do documento: ' + erroInsert.message);
        setEnviandoNome(null);
        return;
      }
    }

    toast.success(`"${item.nome}" enviado com sucesso!`);
    setEnviandoNome(null);
    await carregar();
  };

  /** Editar metadados = editar a VALIDADE, sem tocar no arquivo. */
  const salvarValidade = async (item: ItemDoCofre, validade?: string) => {
    if (!item.dbId) return;
    setSalvandoValidade(true);
    const { data: ok, error } = await supabase
      .from('documentos')
      // `empresa_id` fica FORA do update de propósito: editar uma data não é
      // decisão de compartilhamento, e mexer nela aqui reabriria por outra
      // porta o descompartilhamento silencioso corrigido acima.
      .update({ validade: validade ?? null } as never)
      .eq('id', item.dbId)
      .select('id');
    setSalvandoValidade(false);
    if (error || !ok?.length) {
      toast.error('Não foi possível salvar a validade: ' + (error?.message ?? 'sem permissão para esta linha'));
      return;
    }
    setDialogo(null);
    toast.success('Validade atualizada.');
    await carregar();
  };

  const visualizar = async (item: ItemDoCofre) => {
    if (!item.arquivoPath) { toast.error('Nenhum arquivo para visualizar.'); return; }
    const { data, error } = await supabase.storage
      .from('documentos-habilitacao').createSignedUrl(item.arquivoPath, 600);
    if (error || !data?.signedUrl) {
      toast.error('Erro ao abrir: ' + (error?.message ?? 'arquivo não encontrado'));
      return;
    }
    setVisualizando({ nome: item.nome, url: data.signedUrl });
  };

  const baixar = async (item: ItemDoCofre) => {
    if (!item.arquivoPath) { toast.error('Nenhum arquivo disponível para download.'); return; }
    const { data, error } = await supabase.storage
      .from('documentos-habilitacao').download(item.arquivoPath);
    if (error || !data) {
      toast.error('Erro ao baixar: ' + (error?.message ?? 'arquivo não encontrado'));
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeDoArquivo(item.arquivoPath);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`"${item.nome}" baixado com sucesso!`);
  };

  /** Linha anterior à conversão: move o arquivo e grava o `empresa_id`.
   *  Compartilhar é decisão de quem anexou, nunca efeito de migration. */
  const compartilhar = async (item: ItemDoCofre) => {
    if (!item.dbId || !empresaAtiva || !user) return;
    let novoCaminho = item.arquivoPath;
    if (item.arquivoPath?.startsWith(`${user.id}/`)) {
      novoCaminho = `empresa/${empresaAtiva.id}/${nomeDoArquivo(item.arquivoPath)}`;
      const { error: erroMove } = await supabase.storage
        .from('documentos-habilitacao')
        .move(item.arquivoPath, novoCaminho);
      if (erroMove && !/already exists/i.test(erroMove.message)) {
        toast.error('Não foi possível mover o arquivo: ' + erroMove.message);
        return;
      }
    }
    const { data: ok, error } = await supabase
      .from('documentos')
      .update({ empresa_id: empresaAtiva.id, arquivo_path: novoCaminho ?? null } as never)
      .eq('id', item.dbId)
      .select('id');
    if (error || !ok?.length) {
      toast.error('Não foi possível compartilhar: ' + (error?.message ?? 'linha não encontrada'));
      return;
    }
    toast.success(`Agora toda a equipe de ${empresaAtiva.nome_fantasia ?? empresaAtiva.razao_social} vê este documento.`);
    await carregar();
  };

  const excluir = async (item: ItemDoCofre) => {
    setAExcluir(null);
    if (!user) return;
    setRemovendoNome(item.nome);

    // A LINHA sai primeiro: é nela que o RLS decide (dono ou Admin da empresa).
    // Na ordem inversa, um membro sem permissão perderia o ARQUIVO e a linha
    // ficaria apontando para o nada.
    if (item.dbId) {
      const { data: removidas, error } = await supabase
        .from('documentos').delete().eq('id', item.dbId).select('id');
      if (error || !removidas?.length) {
        toast.error(error
          ? 'Erro ao remover cadastro: ' + error.message
          : 'Documento da empresa: só o dono do anexo ou o Admin podem remover.');
        setRemovendoNome(null);
        return;
      }
    }
    if (item.arquivoPath) {
      await supabase.storage.from('documentos-habilitacao').remove([item.arquivoPath]);
    }

    toast.success(`"${item.nome}" removido.`);
    setRemovendoNome(null);
    await carregar();
  };

  /* O painel leva à trilha de auditoria; o filtro por documento é do próprio
     Histórico, que tem busca por nome. Levar para lá já filtrado exigiria um
     segundo parâmetro na URL, e a aba ainda é restrita ao Admin — o botão só
     aparece para quem pode ver. */
  const abrirHistorico = () => definirAba('historico');

  // ── Composição ────────────────────────────────────────────────────────────

  const abas: AbaGestao[] = [
    { valor: 'documentos', rotulo: 'Documentos' },
    { valor: 'atestados', rotulo: 'Atestados' },
    { valor: 'merge', rotulo: 'Unir arquivos' },
    { valor: 'alertas', rotulo: 'Alertas' },
    // Trilha de auditoria: só o Admin da empresa. A aba não aparece para os
    // demais, e o acesso por link direto cai no "Acesso restrito" do próprio
    // componente — sumir sem explicação seria falha silenciosa.
    ...(isCompanyAdmin ? [{ valor: 'historico', rotulo: 'Histórico' }] : []),
  ];

  const colunas: ColunaGestao<ItemDoCofre>[] = [
    {
      chave: 'documento',
      titulo: 'Documento',
      prioridade: 'sempre',
      ordenavel: true,
      largura: '34%',
      render: (i) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium text-foreground">{i.nome}</span>
          <span className="g-meta flex flex-wrap items-center gap-x-2 text-muted-foreground">
            {i.artigo}
            {i.arquivoPath && (
              <span className="truncate">· {nomeDoArquivo(i.arquivoPath)}</span>
            )}
            {i.legadoPrivado && <Badge variant="muted">Só você vê</Badge>}
          </span>
        </div>
      ),
    },
    {
      chave: 'categoria',
      titulo: 'Categoria',
      prioridade: 'desktop',
      ordenavel: true,
      render: (i) => <span className="line-clamp-2">{i.categoria}</span>,
    },
    {
      chave: 'validade',
      titulo: 'Validade',
      prioridade: 'sempre',
      ordenavel: true,
      largura: '11rem',
      render: (i) => <ValidadeDoDocumento validade={i.validade} situacao={i.situacao} />,
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      prioridade: 'sempre',
      ordenavel: true,
      largura: '13rem',
      render: (i) => <SeloDocumento situacao={i.situacao} />,
    },
    {
      chave: 'acoes',
      titulo: <span className="sr-only">Ações</span>,
      alinhamento: 'direita',
      prioridade: 'desktop',
      largura: '11rem',
      // `stopPropagation` no contêiner: clicar num botão de ação não pode também
      // selecionar a linha e abrir o painel por cima do que a pessoa pediu.
      render: (i) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {i.arquivoPath ? (
            <>
              <Button
                size="sm" variant="ghost" onClick={() => visualizar(i)}
                title="Visualizar em tela" aria-label={`Visualizar ${i.nome} em tela`}
              >
                <Eye aria-hidden="true" />
              </Button>
              <Button
                size="sm" variant="ghost" onClick={() => baixar(i)}
                title="Baixar arquivo" aria-label={`Baixar o arquivo de ${i.nome}`}
              >
                <Download aria-hidden="true" />
              </Button>
            </>
          ) : (
            <Button
              size="sm" variant="outline"
              onClick={() => escolherArquivo(i)}
              disabled={enviandoNome === i.nome}
              aria-label={`Anexar arquivo de ${i.nome}`}
            >
              {enviandoNome === i.nome
                ? <Loader2 className="animate-spin" aria-hidden="true" />
                : <Upload aria-hidden="true" />}
              Anexar
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" aria-label={`Mais ações para ${i.nome}`}>
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => escolherArquivo(i)}>
                {i.arquivoPath
                  ? <><Repeat aria-hidden="true" className="mr-2 h-4 w-4" /> Substituir arquivo</>
                  : <><Upload aria-hidden="true" className="mr-2 h-4 w-4" /> Anexar documento</>}
              </DropdownMenuItem>
              {i.dbId && i.vencePorNatureza && (
                <DropdownMenuItem onSelect={() => setDialogo({ item: i, arquivo: null })}>
                  <PencilLine aria-hidden="true" className="mr-2 h-4 w-4" /> Editar validade
                </DropdownMenuItem>
              )}
              {i.legadoPrivado && empresaAtiva && (
                <DropdownMenuItem onSelect={() => compartilhar(i)}>
                  <Users aria-hidden="true" className="mr-2 h-4 w-4" /> Compartilhar com a equipe
                </DropdownMenuItem>
              )}
              {i.arquivoPath && (
                <>
                  <DropdownMenuSeparator />
                  {/* Excluir mora no menu secundário e SEMPRE pede confirmação:
                      é a única ação desta tela que não tem desfazer. */}
                  <DropdownMenuItem
                    className="text-destructive-ink focus:text-destructive-ink"
                    onSelect={() => setAExcluir(i)}
                  >
                    <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" /> Excluir
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const painel = selecionado ? (
    <PainelDocumento
      item={selecionado}
      ocupado={
        enviandoNome === selecionado.nome ? 'enviando'
          : removendoNome === selecionado.nome ? 'removendo'
            : null
      }
      podeVerHistorico={isCompanyAdmin}
      nomeDaEmpresa={empresaAtiva?.nome_fantasia ?? empresaAtiva?.razao_social ?? null}
      aoVisualizar={() => visualizar(selecionado)}
      aoBaixar={() => baixar(selecionado)}
      aoAnexar={() => escolherArquivo(selecionado)}
      aoEditarValidade={() => setDialogo({ item: selecionado, arquivo: null })}
      aoExcluir={() => setAExcluir(selecionado)}
      aoCompartilhar={() => compartilhar(selecionado)}
      aoAbrirHistorico={abrirHistorico}
    />
  ) : null;

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        {/* O cofre é alcançado a partir do checklist de habilitação de um
            processo — daqui a pessoa volta para a pasta de onde veio. */}
        <ProcessoContextoBanner />

        {/* Título, descrição, ícone e trilha vêm do registro
            `lib/navegacao/paginas.ts` pela própria rota. Sem `acoes`: o envio é
            POR VAGA, e a ação "Adicionar documento" vive na barra de
            ferramentas da aba, onde ela sabe escolher a vaga de destino. */}
        <CabecalhoPagina />

        <AbasGestao abas={abas} valor={aba} aoMudar={definirAba} />

        {aba === 'documentos' && (
          <div className="flex flex-col gap-4">
            {erro && (
              <AvisoDeFalha aoTentarNovamente={carregar}>
                Não foi possível carregar os documentos: {erro}
              </AvisoDeFalha>
            )}

            <ConformidadeDocumental contagem={contagem} indisponivel={razaoSemApuracao} />

            <div className="flex flex-col gap-2">
              <IndicadoresCofre
                contagem={contagem}
                filtro={filtroSituacao}
                aoFiltrar={setFiltroSituacao}
                indisponivel={razaoSemApuracao}
              />
              {/* Regra dita em texto: os números contam o checklist INTEIRO.
                  Se seguissem o filtro, clicar em "Vencidos" zeraria os outros
                  quatro e o painel viraria eco do próprio clique. */}
              <p className="g-meta text-muted-foreground">
                Os indicadores contam o checklist inteiro; clicar num deles filtra a tabela abaixo.
                &ldquo;A vencer&rdquo; é subconjunto de &ldquo;Regulares&rdquo; e não soma de novo no total.
              </p>
            </div>

            <BarraFiltros
              busca={busca}
              aoBuscar={setBusca}
              placeholderBusca="Buscar documento pelo nome"
              filtrosAplicados={filtrosAplicados}
              aoLimpar={limparFiltros}
              acao={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="g-controle rounded-[var(--g-raio)]" disabled={modoTodasEmpresas}>
                      <Plus aria-hidden="true" /> Adicionar documento
                    </Button>
                  </DropdownMenuTrigger>
                  {/* O envio é por VAGA — o menu escolhe a vaga em vez de a
                      tela adivinhar, que era a razão de esta ação não existir. */}
                  <DropdownMenuContent align="end" className="max-h-80 w-72 overflow-y-auto">
                    <DropdownMenuLabel>Vagas ainda sem arquivo</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {ausentes.length === 0 ? (
                      <DropdownMenuItem disabled>
                        Todas as vagas já têm arquivo — use &ldquo;Substituir&rdquo; na linha
                      </DropdownMenuItem>
                    ) : (
                      ausentes.map((i) => (
                        <DropdownMenuItem key={i.nome} onSelect={() => escolherArquivo(i)}>
                          <span className="truncate">{i.nome}</span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            >
              <div className="flex w-full flex-col gap-1 md:w-56">
                {/* `text-[0.75rem] font-normal leading-4` repete o g-meta em
                    utilitários: o Label traz `text-sm font-medium` como utilitário e
                    vencia a classe de componente — "Categoria" saía maior que
                    "Período de validade", que é um span (print de 17/09). É 0.75rem
                    e não `text-xs` porque aqui `text-xs` vale 13 px. */}
                <Label htmlFor="filtro-categoria" className="g-meta text-[0.75rem] font-normal leading-4 text-muted-foreground">Categoria</Label>
                <Select
                  value={filtroCategoria}
                  onValueChange={(v) => setFiltroCategoria(v as FiltroCategoria)}
                >
                  <SelectTrigger id="filtro-categoria" className="g-controle rounded-[var(--g-raio)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as categorias</SelectItem>
                    {CATEGORIAS_PREVISTAS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex w-full flex-col gap-1 md:w-56">
                <Label htmlFor="filtro-situacao" className="g-meta text-[0.75rem] font-normal leading-4 text-muted-foreground">Situação</Label>
                <Select
                  value={filtroSituacao}
                  onValueChange={(v) => setFiltroSituacao(v as FiltroSituacao)}
                >
                  <SelectTrigger id="filtro-situacao" className="g-controle rounded-[var(--g-raio)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTROS_DE_SITUACAO.map((f) => (
                      <SelectItem key={f} value={f}>{ROTULO_DO_FILTRO[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex w-full flex-col gap-1 md:w-auto">
                <span className="g-meta text-muted-foreground">Período de validade</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    aria-label="Validade a partir de"
                    value={validadeDe}
                    onChange={(e) => setValidadeDe(e.target.value)}
                    className="g-controle rounded-[var(--g-raio)] md:w-40"
                  />
                  <span className="g-corpo text-muted-foreground">até</span>
                  <Input
                    type="date"
                    aria-label="Validade até"
                    value={validadeAte}
                    onChange={(e) => setValidadeAte(e.target.value)}
                    className="g-controle rounded-[var(--g-raio)] md:w-40"
                  />
                </div>
              </div>
            </BarraFiltros>

            {modoTodasEmpresas ? (
              <AvisoDeContexto
                titulo="Cofre de documentos: escolha uma empresa"
                acao={
                  <div className="flex flex-wrap gap-2">
                    {empresas.map((e) => (
                      <Button
                        key={e.empresa_id}
                        size="sm"
                        variant="outline"
                        onClick={() => setEmpresaAtiva(e.empresa_id)}
                      >
                        {e.empresa.nome_fantasia || e.empresa.razao_social}
                      </Button>
                    ))}
                  </div>
                }
              >
                O checklist de habilitação é de uma empresa por vez — cada CNPJ tem as suas
                certidões, com prazos próprios. Em &ldquo;Todas as empresas&rdquo; não há um cofre
                para mostrar, e listar um vazio faria parecer que os documentos sumiram.
              </AvisoDeContexto>
            ) : (
              <AreaComPainel
                painel={painel}
                tituloPainel={selecionado?.nome ?? 'Detalhes do documento'}
                aoFechar={() => setSelecionadoNome(null)}
              >
                <TabelaGestao
                  descricao="Checklist de documentos de habilitação da empresa"
                  colunas={colunas}
                  itens={ordenados}
                  chaveDoItem={(i) => i.nome}
                  aoSelecionar={(i) => setSelecionadoNome(i.nome)}
                  selecionado={(i) => i.nome === selecionadoNome}
                  ordenacao={ordenacao}
                  aoOrdenar={alternarOrdenacao}
                  carregando={carregando && !erro}
                  vazio={
                    // Sem resultado de FILTRO é diferente de cofre vazio — e o
                    // cofre nunca está vazio, porque as vagas previstas são
                    // sempre linhas. Só o filtro pode zerar a lista.
                    <EstadoVazio
                      icone={<FolderOpen />}
                      titulo="Nenhum documento com esses filtros"
                      descricao="Ajuste a busca, a categoria, a situação ou o período de validade para ver as demais vagas do checklist."
                      acao={<Button variant="outline" onClick={limparFiltros}>Limpar filtros</Button>}
                    />
                  }
                  rodape={
                    <>
                      <span className="tabular-nums">
                        {ordenados.length} de {itens.length} {itens.length === 1 ? 'item previsto' : 'itens previstos'}
                      </span>
                      {(validadeDe || validadeAte) && (
                        <span>
                          O recorte por período mostra só os itens COM data de validade.
                        </span>
                      )}
                    </>
                  }
                />
              </AreaComPainel>
            )}
          </div>
        )}

        {/* As quatro abas seguintes são pontos de montagem: o conteúdo de cada
            uma pertence ao seu próprio componente. */}
        {aba === 'atestados' && <AtestadosCapacidadeTecnica />}
        {aba === 'merge' && <MergeDocumentos />}
        {aba === 'alertas' && <AlertasVencimentoEmail />}
        {/* O Histórico resolve sozinho a própria autorização e os próprios
            filtros (RLS + `isCompanyAdmin` lá dentro). Esta tela só decide se a
            ABA existe — esconder a aba nunca autorizou nada. */}
        {aba === 'historico' && <HistoricoDocumentos />}

        {/* Campo de arquivo escondido: o destino é a vaga que o clique gravou. */}
        <input
          ref={inputArquivo}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={aoEscolherArquivo}
        />

        {dialogo && (
          <DialogValidade
            aberto
            aoFechar={() => setDialogo(null)}
            nomeDoDocumento={dialogo.item.nome}
            vencePorNatureza={dialogo.item.vencePorNatureza}
            arquivo={dialogo.arquivo}
            validadeInicial={dialogo.item.validade}
            salvando={salvandoValidade || enviandoNome === dialogo.item.nome}
            aoConfirmar={(validade) => {
              if (dialogo.arquivo) enviarArquivo(dialogo.item, dialogo.arquivo, validade);
              else salvarValidade(dialogo.item, validade);
            }}
          />
        )}

        {/* Conferência em tela: o PDF abre aqui; formato que o navegador não
            renderiza cai no download. */}
        <Dialog open={!!visualizando} onOpenChange={(o) => !o && setVisualizando(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="g-titulo-secao">{visualizando?.nome}</DialogTitle>
            </DialogHeader>
            {visualizando && (
              <iframe
                src={visualizando.url}
                title={visualizando.nome}
                className="h-[70vh] w-full rounded-[var(--g-raio)] border border-border bg-muted"
              />
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!aExcluir} onOpenChange={(o) => !o && setAExcluir(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir &ldquo;{aExcluir?.nome}&rdquo;?</AlertDialogTitle>
              <AlertDialogDescription>
                O arquivo sai do cofre e a vaga volta para &ldquo;Ausente&rdquo;. Não há como
                desfazer — será preciso anexar o documento de novo.
                {aExcluir && !aExcluir.legadoPrivado
                  && ' Documento da empresa: só o dono do anexo ou o Admin conseguem remover.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => aExcluir && excluir(aExcluir)}
              >
                Excluir documento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
