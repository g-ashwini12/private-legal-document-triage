import { SimpleDeadlineItem } from '@/types';

/**
 * Export all deadlines as a standard RFC 5545 .ics file download.
 */
export function exportDeadlinesToICS(
  deadlines: SimpleDeadlineItem[],
  documentName: string = 'Legal Document'
) {
  if (!deadlines || deadlines.length === 0) return;

  const now = new Date();
  const formatICSDate = (d: Date) => {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Private Legal Document Triage//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  deadlines.forEach((item, index) => {
    let eventDate = new Date();
    const parsed = Date.parse(item.date_display);
    if (!isNaN(parsed)) {
      eventDate = new Date(parsed);
    } else {
      // Default to staggered reminder dates (e.g. 7 days, 14 days, 30 days)
      eventDate.setDate(eventDate.getDate() + (index + 1) * 14);
    }

    const startDateStr = formatICSDate(eventDate);
    const endDate = new Date(eventDate.getTime() + 60 * 60 * 1000);
    const endDateStr = formatICSDate(endDate);

    icsLines.push(
      'BEGIN:VEVENT',
      `UID:${Date.now()}-${index}@legaltriage.local`,
      `DTSTAMP:${formatICSDate(now)}`,
      `DTSTART:${startDateStr}`,
      `DTEND:${endDateStr}`,
      `SUMMARY:Deadline: ${item.event.replace(/[\r\n]+/g, ' ')}`,
      `DESCRIPTION:${item.event.replace(/[\r\n]+/g, ' ')}\\nReference: ${item.clause_ref || 'Agreement'}\\nDocument: ${documentName}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'DESCRIPTION:Reminder 1 Day Before',
      'ACTION:DISPLAY',
      'END:VALARM',
      'END:VEVENT'
    );
  });

  icsLines.push('END:VCALENDAR');

  const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeFilename = documentName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
  link.setAttribute('download', `${safeFilename}_deadlines.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate a direct Google Calendar web link for a single deadline.
 */
export function getGoogleCalendarLink(
  item: SimpleDeadlineItem,
  documentName: string = 'Legal Document'
): string {
  const title = encodeURIComponent(`Legal Deadline: ${item.event}`);
  const details = encodeURIComponent(
    `${item.event}\nReference: ${item.clause_ref || 'Agreement'}\nDocument: ${documentName}`
  );

  let eventDate = new Date();
  const parsed = Date.parse(item.date_display);
  if (!isNaN(parsed)) {
    eventDate = new Date(parsed);
  } else {
    eventDate.setDate(eventDate.getDate() + 14);
  }

  const startIso = eventDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const endIso = new Date(eventDate.getTime() + 60 * 60 * 1000)
    .toISOString()
    .replace(/[-:]/g, '')
    .split('.')[0] + 'Z';

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${startIso}/${endIso}`;
}
