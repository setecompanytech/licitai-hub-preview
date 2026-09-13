import { useState } from "react";
import { mesLocal } from '@/lib/financeiro/data-local';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import EstadoVazio from "@/components/shared/EstadoVazio";
import { Plus, Calculator, Users, Calendar, Trash2, Pencil } from "lucide-react";
import {
  useFuncionarios, useUpsertFuncionario, useDeleteFuncionario,
  useCompetencias, useHoleritesCompetencia, useProcessarFolha,
  type Funcionario, type TipoVinculo, type StatusCompetencia,
} from "@/hooks/useFinanceiroFolha";

const fmt = (v: number | null) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TIPO_VINCULO_LABEL: Record<TipoVinculo, string> = {
  clt: "CLT",
  pro_labore: "Pró-labore",
  autonomo: "Autônomo",
  estagiario: "Estagiário",
  terceirizado: "Terceirizado",
};

/** Cor do selo de competência — o texto do status continua sendo a pista principal. */
const STATUS_COMPETENCIA: Record<StatusCompetencia, "success" | "warning" | "info" | "muted"> = {
  aberta: "warning",
  calculada: "info",
  fechada: "success",
  paga: "success",
  cancelada: "muted",
};

/** O texto do selo — o valor cru do banco ("aberta") não é rótulo de tela. */
const STATUS_COMPETENCIA_LABEL: Record<StatusCompetencia, string> = {
  aberta: "Aberta",
  calculada: "Calculada",
  fechada: "Fechada",
  paga: "Paga",
  cancelada: "Cancelada",
};

function FuncionarioForm({ funcionario, onClose }: { funcionario?: Funcionario | null; onClose: () => void }) {
  const upsert = useUpsertFuncionario();
  const [form, setForm] = useState<Partial<Funcionario>>(funcionario ?? {
    nome: "", tipo_vinculo: "clt", salario_base: 0, ativo: true, num_dependentes: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsert.mutateAsync(form as any);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="func-nome">Nome *</Label>
          <Input id="func-nome" value={form.nome ?? ""} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="func-cpf">CPF</Label>
          <Input id="func-cpf" value={form.cpf ?? ""} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="func-vinculo">Tipo de vínculo *</Label>
          <Select value={form.tipo_vinculo} onValueChange={(v: TipoVinculo) => setForm(f => ({ ...f, tipo_vinculo: v }))}>
            <SelectTrigger id="func-vinculo"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TIPO_VINCULO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="func-cargo">Cargo</Label>
          <Input id="func-cargo" value={form.cargo ?? ""} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="func-departamento">Departamento</Label>
          <Input id="func-departamento" value={form.departamento ?? ""} onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="func-salario">Salário base *</Label>
          <Input id="func-salario" type="number" step="0.01" value={form.salario_base ?? 0} onChange={e => setForm(f => ({ ...f, salario_base: Number(e.target.value) }))} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="func-dependentes">Dependentes</Label>
          <Input id="func-dependentes" type="number" value={form.num_dependentes ?? 0} onChange={e => setForm(f => ({ ...f, num_dependentes: Number(e.target.value) }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="func-plano-saude">Plano de saúde (R$)</Label>
          <Input id="func-plano-saude" type="number" step="0.01" value={form.plano_saude ?? 0} onChange={e => setForm(f => ({ ...f, plano_saude: Number(e.target.value) }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="func-vale-refeicao">Vale-refeição (R$)</Label>
          <Input id="func-vale-refeicao" type="number" step="0.01" value={form.vale_refeicao ?? 0} onChange={e => setForm(f => ({ ...f, vale_refeicao: Number(e.target.value) }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="func-admissao">Data admissão</Label>
          <Input id="func-admissao" type="date" value={form.data_admissao ?? ""} onChange={e => setForm(f => ({ ...f, data_admissao: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="func-pix">PIX</Label>
          <Input id="func-pix" value={form.pix ?? ""} onChange={e => setForm(f => ({ ...f, pix: e.target.value }))} />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={upsert.isPending}>{upsert.isPending ? "Salvando..." : "Salvar"}</Button>
      </DialogFooter>
    </form>
  );
}

function FuncionariosTab() {
  const { data: funcionarios = [], isLoading } = useFuncionarios();
  const del = useDeleteFuncionario();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Funcionario | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Funcionários</h3>
          <p className="text-sm text-muted-foreground">{funcionarios.length} cadastrado(s)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="w-4 h-4" aria-hidden="true" />Novo funcionário</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} funcionário</DialogTitle></DialogHeader>
            <FuncionarioForm funcionario={editing} onClose={() => { setDialogOpen(false); setEditing(null); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Vínculo</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead className="text-right">Salário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"><span className="sr-only">Ações</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : funcionarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EstadoVazio
                      icone={<Users />}
                      titulo="Nenhum funcionário cadastrado"
                      descricao="Cadastre quem entra na folha para calcular INSS, IRRF, FGTS e encargos."
                      tamanho="compacto"
                    />
                  </TableCell>
                </TableRow>
              ) : funcionarios.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell><Badge variant="muted">{TIPO_VINCULO_LABEL[f.tipo_vinculo]}</Badge></TableCell>
                  <TableCell>{f.cargo ?? "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(f.salario_base)}</TableCell>
                  <TableCell>{f.ativo ? <Badge variant="success">Ativo</Badge> : <Badge variant="muted">Inativo</Badge>}</TableCell>
                  <TableCell className="space-x-1">
                    <Button size="icon" variant="ghost" aria-label={`Editar ${f.nome}`} onClick={() => { setEditing(f); setDialogOpen(true); }}><Pencil className="w-4 h-4" aria-hidden="true" /></Button>
                    <Button size="icon" variant="ghost" aria-label={`Remover ${f.nome}`} onClick={() => { if (confirm(`Remover ${f.nome}?`)) del.mutate(f.id); }}><Trash2 className="w-4 h-4 text-destructive" aria-hidden="true" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ProcessamentoTab() {
  const { data: competencias = [] } = useCompetencias();
  const processar = useProcessarFolha();
  const [mes, setMes] = useState(() => mesLocal());
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const { data: holerites = [] } = useHoleritesCompetencia(selecionada);

  const handleProcessar = () => {
    processar.mutate({ competencia: `${mes}-01` });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calculator className="w-5 h-5" aria-hidden="true" />Processar folha</CardTitle>
          <CardDescription>Calcula INSS, IRRF, FGTS e encargos para todos os funcionários ativos.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="folha-competencia">Competência</Label>
            <Input id="folha-competencia" type="month" value={mes} onChange={e => setMes(e.target.value)} />
          </div>
          <Button onClick={handleProcessar} disabled={processar.isPending}>
            {processar.isPending ? "Processando..." : "Processar folha"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Competências processadas</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Proventos</TableHead>
                <TableHead className="text-right">Descontos</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead className="text-right">Encargos</TableHead>
                <TableHead><span className="sr-only">Ações</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competencias.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EstadoVazio
                      icone={<Calendar />}
                      titulo="Nenhuma competência processada"
                      descricao="Escolha o mês acima e clique em Processar folha para gerar os holerites."
                      tamanho="compacto"
                    />
                  </TableCell>
                </TableRow>
              ) : competencias.map(c => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelecionada(c.id)}>
                  <TableCell>{new Date(c.competencia).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COMPETENCIA[c.status] ?? "muted"}>
                      {STATUS_COMPETENCIA_LABEL[c.status] ?? c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(c.total_proventos)}</TableCell>
                  <TableCell className="text-right tabular-nums text-destructive-ink">{fmt(c.total_descontos)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{fmt(c.total_liquido)}</TableCell>
                  <TableCell className="text-right tabular-nums text-warning-ink">{fmt(c.total_encargos)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Ver holerites de ${new Date(c.competencia).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`}
                      onClick={(e) => { e.stopPropagation(); setSelecionada(c.id); }}
                    >
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selecionada && holerites.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Holerites — Competência selecionada</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Vínculo</TableHead>
                  <TableHead className="text-right">Proventos</TableHead>
                  <TableHead className="text-right">INSS</TableHead>
                  <TableHead className="text-right">IRRF</TableHead>
                  <TableHead className="text-right">FGTS</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holerites.map((h: any) => (
                  <TableRow key={h.id}>
                    <TableCell>{h.funcionario?.nome}</TableCell>
                    <TableCell>{TIPO_VINCULO_LABEL[h.funcionario?.tipo_vinculo as TipoVinculo] ?? "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(h.total_proventos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(h.valor_inss)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(h.valor_irrf)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(h.valor_fgts)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmt(h.total_liquido)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function FinFolha() {
  return (
    <Tabs defaultValue="funcionarios" className="space-y-4">
      <TabsList>
        <TabsTrigger value="funcionarios"><Users className="w-4 h-4 mr-2" aria-hidden="true" />Funcionários</TabsTrigger>
        <TabsTrigger value="processamento"><Calendar className="w-4 h-4 mr-2" aria-hidden="true" />Processamento</TabsTrigger>
      </TabsList>
      <TabsContent value="funcionarios"><FuncionariosTab /></TabsContent>
      <TabsContent value="processamento"><ProcessamentoTab /></TabsContent>
    </Tabs>
  );
}
