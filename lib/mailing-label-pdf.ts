import { jsPDF } from 'jspdf';
import {
  LABEL_PAD_TOP,
  LABEL_PAD_X,
  type AveryTemplate,
  type MailingLabelContact,
  fitLabelText,
  labelLineHeightIn,
  labelPitchX,
  labelPitchY,
  labelsPerSheet,
  logicalLabelLines,
  mailingLabelFilename,
} from '@/lib/mailing-labels';

export function buildMailingLabelPdf(
  template: AveryTemplate,
  contacts: readonly MailingLabelContact[],
  options: { includeCountry?: boolean } = {}
): jsPDF {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter',
  });

  const measure = (text: string, fontSizePt: number) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(fontSizePt);
    return pdf.getTextWidth(text);
  };

  const fitted = contacts.map((contact) =>
    fitLabelText(logicalLabelLines(contact, options) ?? [], template, measure)
  );
  const perSheet = labelsPerSheet(template);
  const stepX = labelPitchX(template);
  const stepY = labelPitchY(template);

  pdf.setTextColor(0, 0, 0);

  fitted.forEach((label, index) => {
    const onPage = index % perSheet;
    if (index > 0 && onPage === 0) pdf.addPage();

    const column = onPage % template.columns;
    const row = Math.floor(onPage / template.columns);
    const x = template.marginLeft + column * stepX + LABEL_PAD_X;
    const lineHeight = labelLineHeightIn(label.fontSizePt);
    let baseline = template.marginTop + row * stepY + LABEL_PAD_TOP + label.fontSizePt / 72;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(label.fontSizePt);
    label.lines.forEach((line) => {
      pdf.text(line, x, baseline);
      baseline += lineHeight;
    });
  });

  return pdf;
}

export function downloadMailingLabelPdf(
  template: AveryTemplate,
  contacts: readonly MailingLabelContact[],
  options: { includeCountry?: boolean } = {}
) {
  const pdf = buildMailingLabelPdf(template, contacts, options);
  pdf.save(mailingLabelFilename(template.id, 'pdf'));
}
