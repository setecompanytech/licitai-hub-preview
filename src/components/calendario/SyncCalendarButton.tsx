import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CalendarPlus, Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  CalendarEvent,
  downloadICS,
  generateGoogleCalendarUrl,
  generateOutlookUrl,
} from '@/lib/calendar-sync';

interface SyncCalendarButtonProps {
  events: CalendarEvent[];
  singleEvent?: CalendarEvent;
}

export default function SyncCalendarButton({ events, singleEvent }: SyncCalendarButtonProps) {
  const [open, setOpen] = useState(false);

  const handleDownloadICS = () => {
    const target = singleEvent ? [singleEvent] : events;
    if (target.length === 0) {
      toast.warning('Nenhum evento para exportar');
      return;
    }
    downloadICS(target, singleEvent ? 'licitacao.ics' : 'licitacoes.ics');
    toast.success(`${target.length} evento(s) exportado(s) no formato ICS`);
    setOpen(false);
  };

  const handleGoogle = () => {
    const event = singleEvent || events[0];
    if (!event) {
      toast.warning('Nenhum evento para sincronizar');
      return;
    }
    window.open(generateGoogleCalendarUrl(event), '_blank');
    setOpen(false);
  };

  const handleOutlook = () => {
    const event = singleEvent || events[0];
    if (!event) {
      toast.warning('Nenhum evento para sincronizar');
      return;
    }
    window.open(generateOutlookUrl(event), '_blank');
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarPlus className="w-4 h-4" />
          Sincronizar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleGoogle} className="gap-2 cursor-pointer">
          <ExternalLink className="w-4 h-4" />
          Google Agenda
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleOutlook} className="gap-2 cursor-pointer">
          <ExternalLink className="w-4 h-4" />
          Outlook / Hotmail
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDownloadICS} className="gap-2 cursor-pointer">
          <Download className="w-4 h-4" />
          Baixar .ICS ({singleEvent ? '1 evento' : `${events.length} eventos`})
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
