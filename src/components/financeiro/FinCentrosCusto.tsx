import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import EstadoVazio from "@/components/shared/EstadoVazio";
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
        <TabsTrigger value="cc" className="gap-2">
          <FolderTree className="w-4 h-4" aria-hidden="true" />
          Centros de Custo
        </TabsTrigger>
        <TabsTrigger value="proj" className="gap-2">
          <Briefcase className="w-4 h-4" aria-hidden="true" />
          Projetos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="cc">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle>Centros de Custo</CardTitle>
            <Dialog open={openCC} onOpenChange={setOpenCC}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setEditCC({ ativo: true })}>
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Novo centro de custo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editCC?.id ? "Editar" : "Novo"} Centro de Custo</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cc-codigo">Código *</Label>
                    <Input id="cc-codigo" value={editCC?.codigo || ""} onChange={(e) => setEditCC({ ...editCC, codigo: e.target.value })} placeholder="01" aria-required="true" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cc-nome">Nome *</Label>
                    <Input id="cc-nome" value={editCC?.nome || ""} onChange={(e) => setEditCC({ ...editCC, nome: e.target.value })} placeholder="Comercial" aria-required="true" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="cc-descricao">Descrição</Label>
                    <Textarea id="cc-descricao" value={editCC?.descricao || ""} onChange={(e) => setEditCC({ ...editCC, descricao: e.target.value })} rows={2} />
                  </div>
                  <div className="flex items-center gap-2 md:col-span-2">
                    <Switch id="cc-ativo" checked={editCC?.ativo ?? true} onCheckedChange={(v) => setEditCC({ ...editCC, ativo: v })} />
                    <Label htmlFor="cc-ativo">Ativo</Label>
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
            {ccs.length === 0 ? (
              <EstadoVazio
                tamanho="compacto"
                icone={<FolderTree aria-hidden="true" />}
                titulo="Nenhum centro de custo"
                descricao="Crie centros de custo para separar despesas e receitas por departamento nos lançamentos."
                acao={
                  <Button onClick={() => { setEditCC({ ativo: true }); setOpenCC(true); }}>
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Novo centro de custo
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-sm font-semibold">Código</TableHead>
                      <TableHead className="text-sm font-semibold">Nome</TableHead>
                      <TableHead className="text-sm font-semibold">Status</TableHead>
                      <TableHead className="w-24 text-sm font-semibold">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ccs.map((cc) => (
                      <TableRow key={cc.id}>
                        <TableCell className="font-mono text-sm">{cc.codigo}</TableCell>
                        <TableCell>{cc.nome}</TableCell>
                        <TableCell>
                          <Badge variant={cc.ativo ? "success" : "muted"}>{cc.ativo ? "Ativo" : "Inativo"}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Button size="icon" variant="ghost" aria-label={`Editar ${cc.nome}`} onClick={() => { setEditCC(cc); setOpenCC(true); }}>
                            <Pencil className="w-4 h-4" aria-hidden="true" />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label={`Excluir ${cc.nome}`} onClick={() => excluirCC(cc.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" aria-hidden="true" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="proj">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle>Projetos</CardTitle>
            <Dialog open={openProj} onOpenChange={setOpenProj}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setEditProj({ ativo: true, status: "ativo" })}>
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Novo projeto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editProj?.id ? "Editar" : "Novo"} Projeto</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="proj-codigo">Código *</Label>
                    <Input id="proj-codigo" value={editProj?.codigo || ""} onChange={(e) => setEditProj({ ...editProj, codigo: e.target.value })} placeholder="P-001" aria-required="true" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proj-nome">Nome *</Label>
                    <Input id="proj-nome" value={editProj?.nome || ""} onChange={(e) => setEditProj({ ...editProj, nome: e.target.value })} placeholder="Pregão 005/2025 - SEDUC" aria-required="true" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="proj-descricao">Descrição</Label>
                    <Textarea id="proj-descricao" value={editProj?.descricao || ""} onChange={(e) => setEditProj({ ...editProj, descricao: e.target.value })} rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proj-data-inicio">Data início</Label>
                    <Input id="proj-data-inicio" type="date" value={editProj?.data_inicio || ""} onChange={(e) => setEditProj({ ...editProj, data_inicio: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proj-data-fim">Data fim</Label>
                    <Input id="proj-data-fim" type="date" value={editProj?.data_fim || ""} onChange={(e) => setEditProj({ ...editProj, data_fim: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proj-valor">Valor orçado (R$)</Label>
                    <Input id="proj-valor" type="number" step="0.01" value={editProj?.valor_orcado || ""} onChange={(e) => setEditProj({ ...editProj, valor_orcado: parseFloat(e.target.value) || null })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proj-licitacao">ID Licitação (opcional)</Label>
                    <Input id="proj-licitacao" value={editProj?.licitacao_id || ""} onChange={(e) => setEditProj({ ...editProj, licitacao_id: e.target.value })} placeholder="UUID do processo" />
                  </div>
                  <div className="flex items-center gap-2 md:col-span-2">
                    <Switch id="proj-ativo" checked={editProj?.ativo ?? true} onCheckedChange={(v) => setEditProj({ ...editProj, ativo: v })} />
                    <Label htmlFor="proj-ativo">Ativo</Label>
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
            {projs.length === 0 ? (
              <EstadoVazio
                tamanho="compacto"
                icone={<Briefcase aria-hidden="true" />}
                titulo="Nenhum projeto"
                descricao="Crie projetos para apurar custo e orçamento por contrato ou processo licitatório."
                acao={
                  <Button onClick={() => { setEditProj({ ativo: true, status: "ativo" }); setOpenProj(true); }}>
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Novo projeto
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-sm font-semibold">Código</TableHead>
                      <TableHead className="text-sm font-semibold">Nome</TableHead>
                      <TableHead className="text-right text-sm font-semibold">Orçado</TableHead>
                      <TableHead className="text-sm font-semibold">Status</TableHead>
                      <TableHead className="w-24 text-sm font-semibold">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projs.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-sm">{p.codigo}</TableCell>
                        <TableCell>{p.nome}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.valor_orcado ? Number(p.valor_orcado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.status === "ativo" ? "success" : "muted"} className="capitalize">{p.status}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Button size="icon" variant="ghost" aria-label={`Editar ${p.nome}`} onClick={() => { setEditProj(p); setOpenProj(true); }}>
                            <Pencil className="w-4 h-4" aria-hidden="true" />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label={`Excluir ${p.nome}`} onClick={() => excluirProj(p.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" aria-hidden="true" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
