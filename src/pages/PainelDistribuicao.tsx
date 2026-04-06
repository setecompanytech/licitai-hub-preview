import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Play, Send, Database, CheckCircle2, Clock, AlertTriangle, FileText, Loader2 } from "lucide-react";

export default function PainelDistribuicao() {
  const { toast } = useToast();
  const [portais, setPortais] = useState<any[]>([]);
  const [editais, setEditais] = useState<any[]>([]);
  const [distribuicoes, setDistribuicoes] = useState<any[]>([]);
  const [metricas, setMetricas] = useState({ total: 0, distribuidos: 0, pendentes: 0, comPdf: 0 });
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingPortal, setSyncingPortal] = useState<string | null>(null);
  const [distributing, setDistributing] = useState(false);

  // Test send state
  const [testEditalId, setTestEditalId] = useState("");
  const [testWhatsapp, setTestWhatsapp] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  // Filters
  const [filtroCanal, setFiltroCanal] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const [portaisRes, editaisRes, distRes] = await Promise.all([
        supabase.from("portais_monitorados" as any).select("*").order("nome"),
        supabase.from("editais_coletados" as any).select("*")
          .gte("created_at", new Date(Date.now() - 86400000).toISOString())
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("distribuicoes_realizadas" as any).select("*, editais_coletados(numero, orgao, objeto)")
          .gte("enviado_em", new Date(Date.now() - 86400000).toISOString())
          .order("enviado_em", { ascending: false })
          .limit(100),
      ]);

      setPortais((portaisRes.data as any[]) || []);
      const eds = (editaisRes.data as any[]) || [];
      setEditais(eds);
      setDistribuicoes((distRes.data as any[]) || []);
      setMetricas({
        total: eds.length,
        distribuidos: eds.filter((e: any) => e.distribuido).length,
        pendentes: eds.filter((e: any) => !e.distribuido).length,
        comPdf: eds.filter((e: any) => e.pdf_storage_path).length,
      });
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const sincronizarPortal = async (portalId?: string) => {
    if (portalId) setSyncingPortal(portalId);
    else setSyncingAll(true);

    try {
      const { data, error } = await supabase.functions.invoke("coletar-portais", {
        body: portalId ? { portal_id: portalId } : {},
      });
      if (error) throw error;
      toast({
        title: "Coleta concluída",
        description: `${data?.resultados?.length || 0} portal(is) processado(s)`,
      });
      await carregarDados();
    } catch (e: any) {
      toast({ title: "Erro na coleta", description: e.message, variant: "destructive" });
    }
    setSyncingPortal(null);
    setSyncingAll(false);
  };

  const forcarDistribuicao = async () => {
    setDistributing(true);
    try {
      const { data, error } = await supabase.functions.invoke("distribuir-editais", { body: {} });
      if (error) throw error;
      toast({
        title: "Distribuição concluída",
        description: `${data?.editais_distribuidos || 0} editais distribuídos, ${data?.envios_realizados || 0} envios`,
      });
      await carregarDados();
    } catch (e: any) {
      toast({ title: "Erro na distribuição", description: e.message, variant: "destructive" });
    }
    setDistributing(false);
  };

  const enviarTeste = async () => {
    if (!testEditalId) {
      toast({ title: "Selecione um edital", variant: "destructive" });
      return;
    }
    if (!testWhatsapp && !testEmail) {
      toast({ title: "Informe WhatsApp ou e-mail de teste", variant: "destructive" });
      return;
    }
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("distribuir-editais", {
        body: {
          edital_id: testEditalId,
          whatsapp_teste: testWhatsapp || undefined,
          email_teste: testEmail || undefined,
        },
      });
      if (error) throw error;
      toast({
        title: "Teste enviado",
        description: `${data?.envios_realizados || 0} envio(s) realizado(s)`,
      });
    } catch (e: any) {
      toast({ title: "Erro no teste", description: e.message, variant: "destructive" });
    }
    setSendingTest(false);
  };

  const getStatusPortal = (ultima: string | null) => {
    if (!ultima) return { cor: "destructive" as const, texto: "Nunca coletado" };
    const diffH = (Date.now() - new Date(ultima).getTime()) / (1000 * 60 * 60);
    if (diffH < 3) return { cor: "default" as const, texto: "Online" };
    if (diffH < 12) return { cor: "secondary" as const, texto: "Atrasado" };
    return { cor: "destructive" as const, texto: "Offline" };
  };

  const distFiltradas = distribuicoes.filter((d: any) => {
    if (filtroCanal !== "todos" && d.canal !== filtroCanal) return false;
    if (filtroStatus !== "todos" && d.status !== filtroStatus) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel de Distribuição</h1>
          <p className="text-sm text-muted-foreground">Gerenciamento de portais, editais e distribuições automáticas</p>
        </div>
        <Button onClick={() => sincronizarPortal()} disabled={syncingAll} className="gap-2">
          {syncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sincronizar Todos
        </Button>
      </div>

      {/* Seção 1 — Status dos Portais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5" /> Status dos Portais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>UF</TableHead>
                <TableHead>Última Coleta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {portais.map((p: any) => {
                const st = getStatusPortal(p.ultima_coleta);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase text-xs">{p.tipo}</Badge>
                    </TableCell>
                    <TableCell>{p.uf || "Nacional"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.ultima_coleta ? new Date(p.ultima_coleta).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.cor}>{st.texto}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={syncingPortal === p.id}
                        onClick={() => sincronizarPortal(p.id)}
                        className="gap-1"
                      >
                        {syncingPortal === p.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        Coletar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Seção 2 — Editais Coletados */}
      <div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-foreground">{metricas.total}</p>
              <p className="text-xs text-muted-foreground">Total Coletados (24h)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-success">{metricas.distribuidos}</p>
              <p className="text-xs text-muted-foreground">Distribuídos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-warning">{metricas.pendentes}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-info">{metricas.comPdf}</p>
              <p className="text-xs text-muted-foreground">Com PDF</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" /> Editais Coletados (24h)
            </CardTitle>
            <Button size="sm" variant="outline" onClick={forcarDistribuicao} disabled={distributing} className="gap-1">
              {distributing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Forçar Distribuição
            </Button>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº / Modalidade</TableHead>
                    <TableHead>Órgão</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>UF</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editais.slice(0, 30).map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm">
                        <span className="font-medium">{e.numero || "—"}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">{e.modalidade || "—"}</span>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{e.orgao}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{e.segmento_nome || e.segmento_codigo || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{e.uf || "—"}</TableCell>
                      <TableCell>
                        {e.distribuido ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <Clock className="h-4 w-4 text-warning" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seção 3 — Log de Distribuições */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5" /> Log de Distribuições (24h)
          </CardTitle>
          <div className="flex gap-2 pt-2">
            <Select value={filtroCanal} onValueChange={setFiltroCanal}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos canais</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="falhou">Falhou</SelectItem>
                <SelectItem value="simulado">Simulado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[300px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Edital</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Horário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distFiltradas.slice(0, 50).map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Badge variant={d.canal === "whatsapp" ? "default" : "secondary"} className="text-xs">
                        {d.canal}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[250px] truncate">
                      {(d as any).editais_coletados?.numero || d.edital_id?.substring(0, 8)}
                      {(d as any).editais_coletados?.orgao && (
                        <span className="text-muted-foreground"> — {(d as any).editais_coletados.orgao}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          d.status === "enviado" ? "default" :
                          d.status === "falhou" ? "destructive" : "secondary"
                        }
                        className="text-xs"
                      >
                        {d.status}
                      </Badge>
                      {d.erro && (
                        <span className="block text-xs text-destructive mt-1 max-w-[200px] truncate">{d.erro}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.enviado_em ? new Date(d.enviado_em).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {distFiltradas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhuma distribuição nas últimas 24h
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Seção 4 — Teste de Envio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5" /> Teste de Envio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Edital</label>
              <Select value={testEditalId} onValueChange={setTestEditalId}>
                <SelectTrigger><SelectValue placeholder="Selecione um edital" /></SelectTrigger>
                <SelectContent>
                  {editais.slice(0, 20).map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.numero || e.objeto?.substring(0, 40) || e.id.substring(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">WhatsApp (teste)</label>
              <Input
                placeholder="5591999999999"
                value={testWhatsapp}
                onChange={(e) => setTestWhatsapp(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">E-mail (teste)</label>
              <Input
                placeholder="teste@email.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            <Button onClick={enviarTeste} disabled={sendingTest} className="gap-2">
              {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar Teste
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
