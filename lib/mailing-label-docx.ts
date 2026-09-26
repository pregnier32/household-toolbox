import {
  AlignmentType,
  BorderStyle,
  Document,
  DocumentGridType,
  HeightRule,
  LineRuleType,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  convertInchesToTwip,
} from 'docx';
import {
  LABEL_LINE_FACTOR,
  LABEL_PAD_TOP,
  LABEL_PAD_X,
  type AveryTemplate,
  type LabelMeasurer,
  type MailingLabelContact,
  downloadBlob,
  fitLabelText,
  labelsPerSheet,
  logicalLabelLines,
  mailingLabelFilename,
} from '@/lib/mailing-labels';

// Room below each sheet for Word's section break, taken from the sheet's bottom margin
// so label rows stay on the page instead of spilling onto a page of their own.
const SECTION_BREAK_RESERVE_TWIPS = 360;

const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const cellBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const tableBorders = {
  ...cellBorders,
  insideHorizontal: noBorder,
  insideVertical: noBorder,
};

let measureCanvas: HTMLCanvasElement | null = null;

function measureArial(text: string, fontSizePt: number): number {
  if (typeof document === 'undefined') {
    return (text.length * fontSizePt * 0.5) / 72;
  }
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const context = measureCanvas.getContext('2d');
  if (!context) return (text.length * fontSizePt * 0.5) / 72;
  context.font = `${fontSizePt}pt Arial, Helvetica, sans-serif`;
  return context.measureText(text).width / 96;
}

export function buildMailingLabelDocument(
  template: AveryTemplate,
  contacts: readonly MailingLabelContact[],
  measure: LabelMeasurer = measureArial,
  options: { includeCountry?: boolean } = {}
): Document {
  const pages = chunkContacts(contacts, labelsPerSheet(template));
  return new Document({
    compatibility: {
      doNotSnapToGridInCell: true,
    },
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 20 },
          paragraph: {
            spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
          },
        },
      },
    },
    sections: pages.map((pageContacts) => ({
      properties: {
        page: {
          size: {
            width: convertInchesToTwip(8.5),
            height: convertInchesToTwip(11),
          },
          margin: {
            top: convertInchesToTwip(template.marginTop),
            right: convertInchesToTwip(template.marginRight),
            bottom: Math.max(0, convertInchesToTwip(template.marginBottom) - SECTION_BREAK_RESERVE_TWIPS),
            left: convertInchesToTwip(template.marginLeft),
            header: convertInchesToTwip(0.2),
            footer: convertInchesToTwip(0.2),
          },
        },
        grid: { linePitch: 20, type: DocumentGridType.DEFAULT },
      },
      children: [buildPageTable(template, pageContacts, measure, options)],
    })),
  });
}

export async function downloadMailingLabelDocx(
  template: AveryTemplate,
  contacts: readonly MailingLabelContact[],
  options: { includeCountry?: boolean } = {}
) {
  const document = buildMailingLabelDocument(template, contacts, measureArial, options);
  const blob = await Packer.toBlob(document);
  downloadBlob(blob, mailingLabelFilename(template.id, 'docx'));
}

function chunkContacts(contacts: readonly MailingLabelContact[], pageSize: number): MailingLabelContact[][] {
  const pages: MailingLabelContact[][] = [];
  for (let index = 0; index < contacts.length; index += pageSize) {
    pages.push(contacts.slice(index, index + pageSize));
  }
  return pages.length > 0 ? pages : [[]];
}

function columnWidths(template: AveryTemplate): number[] {
  const label = convertInchesToTwip(template.labelWidth);
  const gap = convertInchesToTwip(template.gapX);
  const widths: number[] = [];
  for (let column = 0; column < template.columns; column += 1) {
    if (column > 0 && gap > 0) widths.push(gap);
    widths.push(label);
  }
  return widths;
}

function buildPageTable(
  template: AveryTemplate,
  pageContacts: readonly MailingLabelContact[],
  measure: LabelMeasurer,
  options: { includeCountry?: boolean }
): Table {
  const widths = columnWidths(template);
  const rows: TableRow[] = [];

  for (let row = 0; row < template.rows; row += 1) {
    const cells: TableCell[] = [];
    for (let column = 0; column < template.columns; column += 1) {
      if (column > 0 && template.gapX > 0) cells.push(gutterCell(template));
      cells.push(labelCell(template, pageContacts[row * template.columns + column], measure, options));
    }
    rows.push(
      new TableRow({
        cantSplit: true,
        height: { value: convertInchesToTwip(template.labelHeight), rule: HeightRule.EXACT },
        children: cells,
      })
    );
  }

  return new Table({
    width: { size: widths.reduce((sum, width) => sum + width, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    alignment: AlignmentType.LEFT,
    indent: { size: 0, type: WidthType.DXA },
    borders: tableBorders,
    margins: { marginUnitType: WidthType.DXA, top: 0, bottom: 0, left: 0, right: 0 },
    rows,
  });
}

function labelCell(
  template: AveryTemplate,
  contact: MailingLabelContact | undefined,
  measure: LabelMeasurer,
  options: { includeCountry?: boolean }
): TableCell {
  const fitted = contact
    ? fitLabelText(logicalLabelLines(contact, options) ?? [], template, measure)
    : { lines: [] as string[], fontSizePt: 10 };
  const line = Math.round(fitted.fontSizePt * LABEL_LINE_FACTOR * 20);
  const texts = fitted.lines.length > 0 ? fitted.lines : [''];
  const inset = convertInchesToTwip(LABEL_PAD_X);

  return new TableCell({
    width: { size: convertInchesToTwip(template.labelWidth), type: WidthType.DXA },
    borders: cellBorders,
    verticalAlign: VerticalAlignTable.TOP,
    margins: { marginUnitType: WidthType.DXA, top: 0, bottom: 0, left: 0, right: 0 },
    children: texts.map(
      (text, index) =>
        new Paragraph({
          spacing: {
            before: index === 0 ? convertInchesToTwip(LABEL_PAD_TOP) : 0,
            after: 0,
            line,
            lineRule: LineRuleType.EXACT,
          },
          indent: { left: inset, right: inset },
          children: text
            ? [new TextRun({ text, font: 'Arial', size: fitted.fontSizePt * 2, snapToGrid: false })]
            : [],
        })
    ),
  });
}

function gutterCell(template: AveryTemplate): TableCell {
  return new TableCell({
    width: { size: convertInchesToTwip(template.gapX), type: WidthType.DXA },
    borders: cellBorders,
    margins: { marginUnitType: WidthType.DXA, top: 0, bottom: 0, left: 0, right: 0 },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
      }),
    ],
  });
}
