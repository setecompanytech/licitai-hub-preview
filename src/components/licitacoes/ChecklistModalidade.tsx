import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Circle, ClipboardList, AlertTriangle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChecklistItem = {
  id: string;
  texto: string;
  obrigatorio: boolean;
  categoria: string;
};

const checklists: Record<string, ChecklistItem[]> = {
  'Pregão Eletrônico': [
    { id: 'pe-1', texto: 'Cadastro e login no portal (Compras.gov.br, BEC, BLL, etc.)', obrigatorio: true, categoria: 'Preparação' },
    { id: 'pe-2', texto: 'Leitura completa do edital e anexos', obrigatorio: true, categoria: 'Preparação' },
    { id: 'pe-3', texto: 'Verificar enquadramento como ME/EPP (LC 123/2006)', obrigatorio: false, categoria: 'Preparação' },
    { id: 'pe-4', texto: 'Declarações exigidas no edital (enviadas via sistema)', obrigatorio: true, categoria: 'Documentação' },
    { id: 'pe-5', texto: 'Proposta comercial conforme modelo do edital', obrigatorio: true, categoria: 'Proposta' },
    { id: 'pe-6', texto: 'Planilha de composição de custos (se exigida)', obrigatorio: false, categoria: 'Proposta' },
    { id: 'pe-7', texto: 'Envio da proposta no sistema antes do horário limite', obrigatorio: true, categoria: 'Envio' },
    { id: 'pe-8', texto: 'Configurar robô de lances / estratégia de lances', obrigatorio: false, categoria: 'Disputa' },
    { id: 'pe-9', texto: 'Acompanhar chat do pregoeiro durante a sessão', obrigatorio: true, categoria: 'Disputa' },
    { id: 'pe-10', texto: 'Documentos de habilitação digitalizados e prontos', obrigatorio: true, categoria: 'Habilitação' },
    { id: 'pe-11', texto: 'Certidões negativas atualizadas (FGTS, CNDT, Receita)', obrigatorio: true, categoria: 'Habilitação' },
    { id: 'pe-12', texto: 'Atestado de capacidade técnica', obrigatorio: true, categoria: 'Habilitação' },
    { id: 'pe-13', texto: 'Enviar documentação no prazo após convocação', obrigatorio: true, categoria: 'Habilitação' },
  ],
  'Concorrência': [
    { id: 'co-1', texto: 'Retirada do edital e seus anexos', obrigatorio: true, categoria: 'Preparação' },
    { id: 'co-2', texto: 'Análise detalhada dos critérios de julgamento', obrigatorio: true, categoria: 'Preparação' },
    { id: 'co-3', texto: 'Visita técnica ao local (se exigida)', obrigatorio: false, categoria: 'Preparação' },
    { id: 'co-4', texto: 'Envelope de Habilitação (docs jurídicos, fiscais, técnicos)', obrigatorio: true, categoria: 'Documentação' },
    { id: 'co-5', texto: 'Envelope de Proposta Técnica (se técnica e preço)', obrigatorio: false, categoria: 'Proposta' },
    { id: 'co-6', texto: 'Envelope de Proposta de Preços', obrigatorio: true, categoria: 'Proposta' },
    { id: 'co-7', texto: 'Garantia de proposta (se exigida — 1% a 5%)', obrigatorio: false, categoria: 'Proposta' },
    { id: 'co-8', texto: 'Protocolar envelopes dentro do prazo', obrigatorio: true, categoria: 'Envio' },
    { id: 'co-9', texto: 'Credenciar representante para a sessão', obrigatorio: true, categoria: 'Sessão' },
    { id: 'co-10', texto: 'Procuração com poderes para recurso/desistência', obrigatorio: true, categoria: 'Sessão' },
  ],
  'Tomada de Preços': [
    { id: 'tp-1', texto: 'Verificar cadastro no SICAF ou CRC do órgão', obrigatorio: true, categoria: 'Preparação' },
    { id: 'tp-2', texto: 'Certificado de Registro Cadastral atualizado', obrigatorio: true, categoria: 'Documentação' },
    { id: 'tp-3', texto: 'Documentação complementar de habilitação', obrigatorio: true, categoria: 'Documentação' },
    { id: 'tp-4', texto: 'Proposta de preços conforme edital', obrigatorio: true, categoria: 'Proposta' },
    { id: 'tp-5', texto: 'Planilha orçamentária detalhada', obrigatorio: true, categoria: 'Proposta' },
    { id: 'tp-6', texto: 'Cronograma físico-financeiro (se obras/serviços)', obrigatorio: false, categoria: 'Proposta' },
    { id: 'tp-7', texto: 'Protocolar documentação dentro do prazo', obrigatorio: true, categoria: 'Envio' },
    { id: 'tp-8', texto: 'Representante credenciado na sessão', obrigatorio: true, categoria: 'Sessão' },
  ],
  'Dispensa': [
    { id: 'di-1', texto: 'Verificar enquadramento legal da dispensa (Art. 75)', obrigatorio: true, categoria: 'Preparação' },
    { id: 'di-2', texto: 'Proposta comercial simplificada', obrigatorio: true, categoria: 'Proposta' },
    { id: 'di-3', texto: 'Documentação fiscal básica (CNPJ, certidões)', obrigatorio: true, categoria: 'Documentação' },
    { id: 'di-4', texto: 'Atestado de capacidade técnica (se solicitado)', obrigatorio: false, categoria: 'Documentação' },
    { id: 'di-5', texto: 'Envio da proposta no prazo estipulado', obrigatorio: true, categoria: 'Envio' },
  ],
  'Leilão': [
    { id: 'le-1', texto: 'Cadastro prévio no sistema do leilão', obrigatorio: true, categoria: 'Preparação' },
    { id: 'le-2', texto: 'Caução ou depósito prévio (se exigido)', obrigatorio: false, categoria: 'Preparação' },
    { id: 'le-3', texto: 'Visita e vistoria dos bens/itens', obrigatorio: false, categoria: 'Preparação' },
    { id: 'le-4', texto: 'Documento de identidade e CPF/CNPJ', obrigatorio: true, categoria: 'Documentação' },
    { id: 'le-5', texto: 'Participar da sessão de lances', obrigatorio: true, categoria: 'Sessão' },
  ],
  'Diálogo Competitivo': [
    { id: 'dc-1', texto: 'Manifestação de interesse na fase de pré-qualificação', obrigatorio: true, categoria: 'Preparação' },
    { id: 'dc-2', texto: 'Documentação de habilitação completa', obrigatorio: true, categoria: 'Documentação' },
    { id: 'dc-3', texto: 'Proposta preliminar de solução técnica', obrigatorio: true, categoria: 'Proposta' },
    { id: 'dc-4', texto: 'Participar das rodadas de diálogo', obrigatorio: true, categoria: 'Sessão' },
    { id: 'dc-5', texto: 'Proposta final com preço', obrigatorio: true, categoria: 'Proposta' },
    { id: 'dc-6', texto: 'Sigilo sobre informações compartilhadas', obrigatorio: true, categoria: 'Sessão' },
  ],
};

export default function ChecklistModalidade() {
  const [modalidade, setModalidade] = useState<string>('Pregão Eletrônico');
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const items = checklists[modalidade] || [];
  const categorias = [...new Set(items.map(i => i.categoria))];
  const progress = items.length > 0 ? Math.round((checked.size / items.length) * 100) : 0;

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleChangeModalidade = (v: string) => {
    setModalidade(v);
    setChecked(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-accent" />
          <h3 className="font-semibold text-sm">Checklist por Modalidade</h3>
        </div>
        <Select value={modalidade} onValueChange={handleChangeModalidade}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(checklists).map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Progress */}
      <div className="bg-card rounded-xl border border-border/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Progresso</span>
          <span className={cn('text-sm font-bold', progress === 100 ? 'text-success' : 'text-accent')}>{progress}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', progress === 100 ? 'bg-success' : 'bg-accent')}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
          <span>{checked.size}/{items.length} concluídos</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-warning" />
            {items.filter(i => i.obrigatorio && !checked.has(i.id)).length} obrigatórios pendentes
          </span>
        </div>
      </div>

      {/* Items by category */}
      {categorias.map(cat => (
        <Card key={cat} className="overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/30 border-b border-border/50">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</h4>
          </div>
          <div className="divide-y divide-border/30">
            {items.filter(i => i.categoria === cat).map(item => (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
              >
                {checked.has(item.id) ? (
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/40 flex-shrink-0" />
                )}
                <span className={cn('text-sm flex-1', checked.has(item.id) && 'line-through text-muted-foreground')}>
                  {item.texto}
                </span>
                {item.obrigatorio && (
                  <Badge variant="outline" className="text-xs text-warning border-warning/30">Obrigatório</Badge>
                )}
              </button>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
