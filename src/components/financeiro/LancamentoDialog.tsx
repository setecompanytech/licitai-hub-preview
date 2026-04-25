import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import {
  useContas,
  useCategorias,
  usePessoas,
  useUpsertLancamento,
  type Lancamento,
} from "@/hooks/useFinanceiro";
import type { Database } from "@/integrations/supabase/types";

type Tipo = Database["public"]["Enums"]["financeiro_tipo_lancamento"];
type Status = Database["public"]["Enums"]["financeiro_status_lancamento"];
type Natureza = Database["public"]["Enums"]["financeiro_natureza"];
type TipoDocumento = Database["public"]["Enums"]["financeiro_tipo_documento"];

const TIPO_DOC_OPTIONS: { value: TipoDocumento; label: string }[] = [
  { value: "nfe", label: "NF-e (Mercadoria)" },
  { value: "nfse", label: "NFS-e (Serviço)" },
  { value: "nfce", label: "NFC-e (Consumidor)" },
  { value: "cte", label: "CT-e (Transporte)" },
  { value: "recibo", label: "Recibo" },
  { value: "boleto", label: "Boleto" },
  { value: "duplicata", label: "Duplicata" },
  { value: "fatura", label: "Fatura" },
  { value: "contrato", label: "Contrato" },
  { value: "pix", label: "PIX" },
  { value: "ted", label: "TED" },
  { value: "doc", label: "DOC" },
  { value: "darf", label: "DARF" },
  { value: "das", label: "DAS" },
  { value: "gps", label: "GPS (INSS)" },
  { value: "gnre", label: "GNRE" },
  { value: "outro", label: "Outros" },
];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<Lancamento> | null;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function LancamentoDialog({ open, onOpenChange, initial }: Props) {
  const { data: contas = [] } = useContas();
  const { data: categorias = [] } = useCategorias();
  const { data: pessoas = [] } = usePessoas();
  const upsert = useUpsertLancamento();

  const [tipo, setTipo] = useState<Tipo>("a_pagar");
  const [natureza, setNatureza] = useState<Natureza>("despesa");
  const [status, setStatus] = useState<Status>("previsto");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [dataCompetencia, setDataCompetencia] = useState(today());
  const [dataVencimento, setDataVencimento] = useState<string>("");
  const [dataRealizado, setDataRealizado] = useState<string>("");
  const [contaId, setContaId] = useState<string>("");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [pessoaId, setPessoaId] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTipo((initial?.tipo as Tipo) ?? "a_pagar");
    setNatureza((initial?.natureza as Natureza) ?? "despesa");
    setStatus((initial?.status as Status) ?? "previsto");
    setDescricao(initial?.descricao ?? "");
    setValor(Number(initial?.valor ?? 0));
    setDataCompetencia(initial?.data_competencia ?? today());
    setDataVencimento(initial?.data_vencimento ?? "");
    setDataRealizado(initial?.data_realizado ?? "");
    setContaId(initial?.conta_id ?? "");
    setCategoriaId(initial?.categoria_id ?? "");
    setPessoaId(initial?.pessoa_id ?? "");
    setObservacoes(initial?.observacoes ?? "");
  }, [open, initial]);

  // Sincroniza natureza padrão por tipo
  useEffect(() => {
    if (tipo === "a_receber") setNatureza("receita");
    else if (tipo === "a_pagar") setNatureza("despesa");
    else setNatureza("movimentacao");
  }, [tipo]);

  const handleSubmit = async () => {
    if (!descricao.trim()) return;
    await upsert.mutateAsync({
      id: initial?.id,
      tipo,
      natureza,
      status,
      descricao: descricao.trim(),
      valor,
      data_competencia: dataCompetencia,
      data_vencimento: dataVencimento || null,
      data_realizado: dataRealizado || null,
      conta_id: contaId || null,
      categoria_id: categoriaId || null,
      pessoa_id: pessoaId || null,
      observacoes: observacoes.trim() || null,
    });
    onOpenChange(false);
  };

  const categoriasFiltradas = categorias.filter((c) =>
    natureza === "movimentacao" ? true : c.natureza === natureza
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="a_pagar">A pagar</SelectItem>
                <SelectItem value="a_receber">A receber</SelectItem>
                <SelectItem value="movimento_bancario">Movimento bancário</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="previsto">Previsto</SelectItem>
                <SelectItem value="realizado">Realizado</SelectItem>
                <SelectItem value="conciliado">Conciliado</SelectItem>
                <SelectItem value="em_atraso">Em atraso</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Descrição *</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Pagamento fornecedor X" />
          </div>

          <div className="space-y-1.5">
            <Label>Valor *</Label>
            <MoneyInput value={valor} onValueChange={setValor} />
          </div>
          <div className="space-y-1.5">
            <Label>Conta</Label>
            <Select value={contaId || "none"} onValueChange={(v) => setContaId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem conta —</SelectItem>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Competência *</Label>
            <Input type="date" value={dataCompetencia} onChange={(e) => setDataCompetencia(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Vencimento</Label>
            <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Pago / recebido em</Label>
            <Input type="date" value={dataRealizado} onChange={(e) => setDataRealizado(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoriaId || "none"} onValueChange={(v) => setCategoriaId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem categoria —</SelectItem>
                {categoriasFiltradas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.codigo} · {c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Pessoa (cliente / fornecedor)</Label>
            <Select value={pessoaId || "none"} onValueChange={(v) => setPessoaId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Não informado —</SelectItem>
                {pessoas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={upsert.isPending || !descricao.trim()}>
            {upsert.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
