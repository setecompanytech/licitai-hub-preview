import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, FolderTree, Briefcase } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

interface Projeto {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  licitacao_id: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  valor_orcado: number | null;
  status: string;
  ativo: boolean;
}

export default function FinCentrosCusto() {
  const { empresaAtiva } = useEmpresa();
  const [ccs, setCcs] = useState<CentroCusto[]>([]);
  const [projs, setProjs] = useState<Projeto[]>([]);
  const [openCC, setOpenCC] = useState(false);
  const [openProj, setOpenProj] = useState(false);
  const [editCC, setEditCC] = useState<Partial<CentroCusto> | null>(null);
  const [editProj, setEditProj] = useState<Partial<Projeto> | null>(null);

  const carregar = async () => {
    if (!empresaAtiva) return;
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("fin_centros_custo").select("*").eq("empresa_id", empresaAtiva.id).order("codigo"),
      supabase.from("fin_projetos").select("*").eq("empresa_id", empresaAtiva.id).order("codigo"),
    ]);
    setCcs(c || []);
    setProjs(p || []);
  };

  useEffect(() => {
    carregar();
  }, [empresaAtiva?.id]);

  const salvarCC = async () => {
    if (!empresaAtiva || !editCC?.codigo || !editCC?.nome) {
      toast({ title: "Preencha código e nome", variant: "destructive" });
      return;
    }
    const payload = {
      empresa_id: empresaAtiva.id,
      codigo: editCC.codigo,
      nome: editCC.nome,
      descricao: editCC.descricao || null,
      ativo: editCC.ativo ?? true,
    };
    const { error } = editCC.id
      ? await supabase.from("fin_centros_custo").update(payload).eq("id", editCC.id)
      : await supabase.from("fin_centros_custo").insert(payload);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Salvo" });
    setOpenCC(false);
    setEditCC(null);
    carregar();
  };

  const excluirCC = async (id: string) => {
    if (!confirm("Excluir centro de custo? Lançamentos vinculados ficarão sem CC.")) return;
    const { error } = await supabase.from("fin_centros_custo").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else carregar();
  };

  const salvarProj = async () => {
    if (!empresaAtiva || !editProj?.codigo || !editProj?.nome) {
      toast({ title: "Preencha código e nome", variant: "destructive" });
      return;
    }
    const payload = {
      empresa_id: empresaAtiva.id,
      codigo: editProj.codigo,
      nome: editProj.nome,
      descricao: editProj.descricao || null,
      licitacao_id: editProj.licitacao_id || null,
      data_inicio: editProj.data_inicio || null,
      data_fim: editProj.data_fim || null,
      valor_orcado: editProj.valor_orcado || null,
      status: editProj.status || "ativo",
      ativo: editProj.ativo ?? true,
    };
    const { error } = editProj.id
      ? await supabase.from("fin_projetos").update(payload).eq("id", editProj.id)
      : await supabase.from("fin_projetos").insert(payload);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Salvo" });
    setOpenProj(false);
    setEditProj(null);
    carregar();
  };

  const excluirProj = async (id: string) => {
    if (!confirm("Excluir projeto?")) return;
    const { error } = await supabase.from("fin_projetos").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else carregar();
  };

  return (
    <Tabs defaultValue="cc" className="space-y-4">
      <TabsList>
        <TabsTrigger value="cc"><FolderTree className="w-4 h-4 mr-1.5" />Centros de Custo</TabsTrigger>
        <TabsTrigger value="proj"><Briefcase className="w-4 h-4 mr-1.5" />Projetos</TabsTrigger>
      </TabsList>

      <TabsContent value="cc">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Centros de Custo</CardTitle>
            <Dialog open={openCC} onOpenChange={setOpenCC}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setEditCC({ ativo: true })}>
                  <Plus className="w-4 h-4 mr-1" />Novo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editCC?.id ? "Editar" : "Novo"} Centro de Custo</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Código *</Label>
                    <Input value={editCC?.codigo || ""} onChange={(e) => setEditCC({ ...editCC, codigo: e.target.value })} placeholder="01" />
                  </div>
                  <div>
                    <Label>Nome *</Label>
                    <Input value={editCC?.nome || ""} onChange={(e) => setEditCC({ ...editCC, nome: e.target.value })} placeholder="Comercial" />
                  </div>
                  <div className="col-span-2">
                    <Label>Descrição</Label>
                    <Textarea value={editCC?.descricao || ""} onChange={(e) => setEditCC({ ...editCC, descricao: e.target.value })} rows={2} />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Switch checked={editCC?.ativo ?? true} onCheckedChange={(v) => setEditCC({ ...editCC, ativo: v })} />
                    <Label>Ativo</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenCC(false)}>Cancelar</Button>
                  <Button onClick={salvarCC}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ccs.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum centro de custo</TableCell></TableRow>
                ) : ccs.map((cc) => (
                  <TableRow key={cc.id}>
                    <TableCell className="font-mono text-sm">{cc.codigo}</TableCell>
                    <TableCell>{cc.nome}</TableCell>
                    <TableCell>{cc.ativo ? "Ativo" : "Inativo"}</TableCell>
                    <TableCell className="space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditCC(cc); setOpenCC(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => excluirCC(cc.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="proj">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Projetos</CardTitle>
            <Dialog open={openProj} onOpenChange={setOpenProj}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setEditProj({ ativo: true, status: "ativo" })}>
                  <Plus className="w-4 h-4 mr-1" />Novo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editProj?.id ? "Editar" : "Novo"} Projeto</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Código *</Label>
                    <Input value={editProj?.codigo || ""} onChange={(e) => setEditProj({ ...editProj, codigo: e.target.value })} placeholder="P-001" />
                  </div>
                  <div>
                    <Label>Nome *</Label>
                    <Input value={editProj?.nome || ""} onChange={(e) => setEditProj({ ...editProj, nome: e.target.value })} placeholder="Pregão 005/2025 - SEDUC" />
                  </div>
                  <div className="col-span-2">
                    <Label>Descrição</Label>
                    <Textarea value={editProj?.descricao || ""} onChange={(e) => setEditProj({ ...editProj, descricao: e.target.value })} rows={2} />
                  </div>
                  <div>
                    <Label>Data início</Label>
                    <Input type="date" value={editProj?.data_inicio || ""} onChange={(e) => setEditProj({ ...editProj, data_inicio: e.target.value })} />
                  </div>
                  <div>
                    <Label>Data fim</Label>
                    <Input type="date" value={editProj?.data_fim || ""} onChange={(e) => setEditProj({ ...editProj, data_fim: e.target.value })} />
                  </div>
                  <div>
                    <Label>Valor orçado (R$)</Label>
                    <Input type="number" step="0.01" value={editProj?.valor_orcado || ""} onChange={(e) => setEditProj({ ...editProj, valor_orcado: parseFloat(e.target.value) || null })} />
                  </div>
                  <div>
                    <Label>ID Licitação (opcional)</Label>
                    <Input value={editProj?.licitacao_id || ""} onChange={(e) => setEditProj({ ...editProj, licitacao_id: e.target.value })} placeholder="UUID do processo" />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Switch checked={editProj?.ativo ?? true} onCheckedChange={(v) => setEditProj({ ...editProj, ativo: v })} />
                    <Label>Ativo</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenProj(false)}>Cancelar</Button>
                  <Button onClick={salvarProj}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Orçado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum projeto</TableCell></TableRow>
                ) : projs.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.codigo}</TableCell>
                    <TableCell>{p.nome}</TableCell>
                    <TableCell>
                      {p.valor_orcado ? Number(p.valor_orcado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-"}
                    </TableCell>
                    <TableCell>{p.status}</TableCell>
                    <TableCell className="space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditProj(p); setOpenProj(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => excluirProj(p.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
