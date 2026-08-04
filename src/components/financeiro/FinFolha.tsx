import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Calculator, Users, Calendar, Trash2, Pencil } from "lucide-react";
import {
  useFuncionarios, useUpsertFuncionario, useDeleteFuncionario,
  useCompetencias, useHoleritesCompetencia, useProcessarFolha,
  type Funcionario, type TipoVinculo,
} from "@/hooks/useFinanceiroFolha";

const fmt = (v: number | null) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TIPO_VINCULO_LABEL: Record<TipoVinculo, string> = {
  clt: "CLT",
  pro_labore: "Pró-labore",
  autonomo: "Autônomo",
  estagiario: "Estagiário",
  terceirizado: "Terceirizado",
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
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Nome *</Label>
          <Input value={form.nome ?? ""} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
        </div>
        <div>
          <Label>CPF</Label>
          <Input value={form.cpf ?? ""} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} />
        </div>
        <div>
          <Label>Tipo de vínculo *</Label>
          <Select value={form.tipo_vinculo} onValueChange={(v: TipoVinculo) => setForm(f => ({ ...f, tipo_vinculo: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TIPO_VINCULO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Cargo</Label>
          <Input value={form.cargo ?? ""} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
        </div>
        <div>
          <Label>Departamento</Label>
          <Input value={form.departamento ?? ""} onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))} />
        </div>
        <div>
          <Label>Salário base *</Label>
          <Input type="number" step="0.01" value={form.salario_base ?? 0} onChange={e => setForm(f => ({ ...f, salario_base: Number(e.target.value) }))} required />
        </div>
        <div>
          <Label>Dependentes</Label>
          <Input type="number" value={form.num_dependentes ?? 0} onChange={e => setForm(f => ({ ...f, num_dependentes: Number(e.target.value) }))} />
        </div>
        <div>
          <Label>Plano de saúde (R$)</Label>
          <Input type="number" step="0.01" value={form.plano_saude ?? 0} onChange={e => setForm(f => ({ ...f, plano_saude: Number(e.target.value) }))} />
        </div>
        <div>
          <Label>Vale-refeição (R$)</Label>
          <Input type="number" step="0.01" value={form.vale_refeicao ?? 0} onChange={e => setForm(f => ({ ...f, vale_refeicao: Number(e.target.value) }))} />
        </div>
        <div>
          <Label>Data admissão</Label>
          <Input type="date" value={form.data_admissao ?? ""} onChange={e => setForm(f => ({ ...f, data_admissao: e.target.value }))} />
        </div>
        <div>
          <Label>PIX</Label>
          <Input value={form.pix ?? ""} onChange={e => setForm(f => ({ ...f, pix: e.target.value }))} />
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
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Funcionários</h3>
          <p className="text-sm text-muted-foreground">{funcionarios.length} cadastrado(s)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="w-4 h-4 mr-1" />Novo</Button>
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
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : funcionarios.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhum funcionário cadastrado.</TableCell></TableRow>
              ) : funcionarios.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell><Badge variant="outline">{TIPO_VINCULO_LABEL[f.tipo_vinculo]}</Badge></TableCell>
                  <TableCell>{f.cargo ?? "-"}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(f.salario_base)}</TableCell>
                  <TableCell>{f.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                  <TableCell className="space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(f); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remover ${f.nome}?`)) del.mutate(f.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const { data: holerites = [] } = useHoleritesCompetencia(selecionada);

  const handleProcessar = () => {
    processar.mutate({ competencia: `${mes}-01` });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calculator className="w-5 h-5" /> Processar Folha</CardTitle>
          <CardDescription>Calcula INSS, IRRF, FGTS e encargos para todos os funcionários ativos.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-3">
          <div>
            <Label>Competência</Label>
            <Input type="month" value={mes} onChange={e => setMes(e.target.value)} />
          </div>
          <Button onClick={handleProcessar} disabled={processar.isPending}>
            {processar.isPending ? "Processando..." : "Processar Folha"}
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
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competencias.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhuma competência processada.</TableCell></TableRow>
              ) : competencias.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelecionada(c.id)}>
                  <TableCell>{new Date(c.competencia).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</TableCell>
                  <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{fmt(c.total_proventos)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{fmt(c.total_descontos)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{fmt(c.total_liquido)}</TableCell>
                  <TableCell className="text-right font-mono text-warning">{fmt(c.total_encargos)}</TableCell>
                  <TableCell><Button size="sm" variant="ghost">Ver</Button></TableCell>
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
                    <TableCell className="text-right font-mono">{fmt(h.total_proventos)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(h.valor_inss)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(h.valor_irrf)}</TableCell>
                    <TableCell className="text-right font-mono text-info">{fmt(h.valor_fgts)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmt(h.total_liquido)}</TableCell>
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
        <TabsTrigger value="funcionarios"><Users className="w-4 h-4 mr-1.5" />Funcionários</TabsTrigger>
        <TabsTrigger value="processamento"><Calendar className="w-4 h-4 mr-1.5" />Processamento</TabsTrigger>
      </TabsList>
      <TabsContent value="funcionarios"><FuncionariosTab /></TabsContent>
      <TabsContent value="processamento"><ProcessamentoTab /></TabsContent>
    </Tabs>
  );
}
