/**
 * Gerador de eventos ICS para sincronização com Google Agenda e Outlook
 */

interface CalendarEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
  url?: string;
  alarm?: number; // minutes before
}

function formatICSDate(date: Date, allDay?: boolean): string {
  if (allDay) {
    return date.toISOString().replace(/[-:]/g, '').split('T')[0];
  }
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function generateICSEvent(event: CalendarEvent): string {
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${event.uid}@praefectus.app`,
    `DTSTAMP:${formatICSDate(new Date())}`,
  ];

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatICSDate(event.start, true)}`);
    if (event.end) {
      lines.push(`DTEND;VALUE=DATE:${formatICSDate(event.end, true)}`);
    }
  } else {
    lines.push(`DTSTART:${formatICSDate(event.start)}`);
    if (event.end) {
      lines.push(`DTEND:${formatICSDate(event.end)}`);
    }
  }

  lines.push(`SUMMARY:${escapeICS(event.title)}`);

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeICS(event.location)}`);
  }
  if (event.url) {
    lines.push(`URL:${event.url}`);
  }

  if (event.alarm && event.alarm > 0) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeICS(event.title)}`,
      `TRIGGER:-PT${event.alarm}M`,
      'END:VALARM'
    );
  }

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

export function generateICSCalendar(events: CalendarEvent[]): string {
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Praefectus//Calendario//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Praefectus - Licitações',
    'X-WR-TIMEZONE:America/Sao_Paulo',
  ].join('\r\n');

  const body = events.map(generateICSEvent).join('\r\n');
  const footer = 'END:VCALENDAR';

  return `${header}\r\n${body}\r\n${footer}`;
}

export function downloadICS(events: CalendarEvent[], filename = 'licitacoes.ics') {
  const icsContent = generateICSCalendar(events);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const params = new URLSearchParams();
  params.set('text', event.title);
  
  const startStr = formatICSDate(event.start).replace('Z', '');
  const endStr = event.end ? formatICSDate(event.end).replace('Z', '') : startStr;
  params.set('dates', `${startStr}/${endStr}`);

  if (event.description) params.set('details', event.description);
  if (event.location) params.set('location', event.location);

  return `${base}&${params.toString()}`;
}

export function generateOutlookUrl(event: CalendarEvent): string {
  const base = 'https://outlook.live.com/calendar/0/deeplink/compose';
  const params = new URLSearchParams();
  params.set('subject', event.title);
  params.set('startdt', event.start.toISOString());
  if (event.end) params.set('enddt', event.end.toISOString());
  if (event.description) params.set('body', event.description);
  if (event.location) params.set('location', event.location);
  params.set('path', '/calendar/action/compose');
  params.set('rru', 'addevent');

  return `${base}?${params.toString()}`;
}

export type { CalendarEvent };
