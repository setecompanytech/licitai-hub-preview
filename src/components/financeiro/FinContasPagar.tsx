import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Table as TableIcon, Calendar as CalendarIcon } from "lucide-react";
import FinKanban from "./FinKanban";
import FinTabelaLancamentos from "./FinTabelaLancamentos";
import FinCalendarioLancamentos from "./FinCalendarioLancamentos";

type Visao = "kanban" | "tabela" | "calendario";

export default function FinContasPagar() {
  const [visao, setVisao] = useState<Visao>("kanban");

  return (
    <div className="space-y-4">
      {/* Alternância de visão como controle segmentado sóbrio: a opção ativa é
          o segmento branco em relevo, as demais ficam em ghost — o verde fica
          reservado à ação principal da tela que vem abaixo. */}
      <div className="flex flex-wrap justify-end gap-2">
        <div className="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1" role="group" aria-label="Visão dos lançamentos">
          <Button size="sm" variant={visao === "kanban" ? "outline" : "ghost"} aria-pressed={visao === "kanban"} onClick={() => setVisao("kanban")}>
            <LayoutGrid aria-hidden="true" />Kanban
          </Button>
          <Button size="sm" variant={visao === "tabela" ? "outline" : "ghost"} aria-pressed={visao === "tabela"} onClick={() => setVisao("tabela")}>
            <TableIcon aria-hidden="true" />Tabela
          </Button>
          <Button size="sm" variant={visao === "calendario" ? "outline" : "ghost"} aria-pressed={visao === "calendario"} onClick={() => setVisao("calendario")}>
            <CalendarIcon aria-hidden="true" />Calendário
          </Button>
        </div>
      </div>

      {visao === "kanban" && <FinKanban tipo="a_pagar" />}
      {visao === "tabela" && <FinTabelaLancamentos tipo="a_pagar" />}
      {visao === "calendario" && <FinCalendarioLancamentos tipo="a_pagar" />}
    </div>
  );
}
