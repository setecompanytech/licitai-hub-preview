import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Table as TableIcon, Calendar as CalendarIcon } from "lucide-react";
import FinKanban from "./FinKanban";
import FinTabelaLancamentos from "./FinTabelaLancamentos";
import FinCalendarioLancamentos from "./FinCalendarioLancamentos";

type Visao = "kanban" | "tabela" | "calendario";

export default function FinContasReceber() {
  const [visao, setVisao] = useState<Visao>("kanban");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <div className="inline-flex flex-wrap gap-1 rounded-md border border-border bg-muted p-1" role="group" aria-label="Visão dos lançamentos">
          <Button size="sm" variant={visao === "kanban" ? "default" : "ghost"} aria-pressed={visao === "kanban"} onClick={() => setVisao("kanban")}>
            <LayoutGrid className="w-4 h-4" />Kanban
          </Button>
          <Button size="sm" variant={visao === "tabela" ? "default" : "ghost"} aria-pressed={visao === "tabela"} onClick={() => setVisao("tabela")}>
            <TableIcon className="w-4 h-4" />Tabela
          </Button>
          <Button size="sm" variant={visao === "calendario" ? "default" : "ghost"} aria-pressed={visao === "calendario"} onClick={() => setVisao("calendario")}>
            <CalendarIcon className="w-4 h-4" />Calendário
          </Button>
        </div>
      </div>

      {visao === "kanban" && <FinKanban tipo="a_receber" />}
      {visao === "tabela" && <FinTabelaLancamentos tipo="a_receber" />}
      {visao === "calendario" && <FinCalendarioLancamentos tipo="a_receber" />}
    </div>
  );
}
