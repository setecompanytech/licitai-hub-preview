import SkeletonPagina from '@/components/shared/SkeletonPagina';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Label } from '@/components/ui/label';
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

  /* Selo suave por situação da coleta: verde no ar, âmbar atrasado, vermelho fora. */
  const getStatusPortal = (ultima: string | null) => {
    if (!ultima) return { cor: "danger" as const, texto: "Nunca coletado" };
    const diffH = (Date.now() - new Date(ultima).getTime()) / (1000 * 60 * 60);
    if (diffH < 3) return { cor: "success" as const, texto: "Online" };
    if (diffH < 12) return { cor: "warning" as const, texto: "Atrasado" };
    return { cor: "danger" as const, texto: "Offline" };
  };

  const distFiltradas = distribuicoes.filter((d: any) => {
    if (filtroCanal !== "todos" && d.canal !== filtroCanal) return false;
    if (filtroStatus !== "todos" && d.status !== filtroStatus) return false;
    return true;
  });

  // Dentro da moldura do app (19/09): a espera mostra a barra e a coluna, e o
  // conteúdo em esqueleto — a tela deixou de ser a única fora do AppLayout.
  if (loading) {
    return (
      <AppLayout>
        <SkeletonPagina moldura={false} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
    <div className="space-y-6">
      <CabecalhoPagina
        rota="/admin/distribuicao"
        descricao="Gerenciamento de portais, editais e distribuições automáticas"
        acoes={
          <Button onClick={() => sincronizarPortal()} disabled={syncingAll}>
            {syncingAll ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            Sincronizar Todos
          </Button>
        }
      />

      {/* Seção 1 — Status dos Portais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
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
                      <Badge variant="outline" className="uppercase">{p.tipo}</Badge>
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
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4 [&>*]:min-w-0">
          {[
            { rotulo: 'Total Coletados (24h)', valor: metricas.total, cor: 'text-foreground' },
            { rotulo: 'Distribuídos', valor: metricas.distribuidos, cor: 'text-success-ink' },
            { rotulo: 'Pendentes', valor: metricas.pendentes, cor: 'text-warning-ink' },
            { rotulo: 'Com PDF', valor: metricas.comPdf, cor: 'text-info-ink' },
          ].map((k) => (
            <div key={k.rotulo} className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
              <p className="truncate text-sm font-medium text-muted-foreground">{k.rotulo}</p>
              <p className={`mt-1 text-2xl font-semibold leading-8 tabular-nums ${k.cor}`}>{k.valor}</p>
            </div>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
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
                          <CheckCircle2 className="h-4 w-4 text-success-ink" aria-label="Distribuído" />
                        ) : (
                          <Clock className="h-4 w-4 text-warning-ink" aria-label="Pendente" />
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
          <CardTitle className="flex items-center gap-2">
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
                      <Badge variant={d.canal === "whatsapp" ? "info" : "muted"}>
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
                          d.status === "enviado" ? "success" :
                          d.status === "falhou" ? "danger" : "muted"
                        }
                      >
                        {d.status}
                      </Badge>
                      {d.erro && (
                        <span className="mt-1 block max-w-[200px] truncate text-xs text-destructive-ink">{d.erro}</span>
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
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Teste de Envio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="dist-edital">Edital</Label>
              <Select value={testEditalId} onValueChange={setTestEditalId}>
                <SelectTrigger id="dist-edital"><SelectValue placeholder="Selecione um edital" /></SelectTrigger>
                <SelectContent>
                  {editais.slice(0, 20).map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.numero || e.objeto?.substring(0, 40) || e.id.substring(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dist-whatsapp">WhatsApp (teste)</Label>
              <Input
                id="dist-whatsapp"
                placeholder="5591999999999"
                value={testWhatsapp}
                onChange={(e) => setTestWhatsapp(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dist-email">E-mail (teste)</Label>
              <Input
                id="dist-email"
                placeholder="teste@email.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            <Button onClick={enviarTeste} disabled={sendingTest}>
              {sendingTest ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              Enviar Teste
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
    </AppLayout>
  );
}
