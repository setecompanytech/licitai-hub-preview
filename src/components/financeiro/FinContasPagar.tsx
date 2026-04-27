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
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
          <Button size="sm" variant={visao === "kanban" ? "default" : "ghost"} className="h-7 px-3 text-xs" onClick={() => setVisao("kanban")}>
            <LayoutGrid className="w-3.5 h-3.5 mr-1" />Kanban
          </Button>
          <Button size="sm" variant={visao === "tabela" ? "default" : "ghost"} className="h-7 px-3 text-xs" onClick={() => setVisao("tabela")}>
            <TableIcon className="w-3.5 h-3.5 mr-1" />Tabela
          </Button>
          <Button size="sm" variant={visao === "calendario" ? "default" : "ghost"} className="h-7 px-3 text-xs" onClick={() => setVisao("calendario")}>
            <CalendarIcon className="w-3.5 h-3.5 mr-1" />Calendário
          </Button>
        </div>
      </div>

      {visao === "kanban" && <FinKanban tipo="a_pagar" />}
      {visao === "tabela" && <FinTabelaLancamentos tipo="a_pagar" />}
      {visao === "calendario" && <FinCalendarioLancamentos tipo="a_pagar" />}
    </div>
  );
}
