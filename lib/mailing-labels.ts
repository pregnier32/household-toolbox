/**
 * US Letter layouts compatible with Avery 5160, 5161, 5162, and 5163.
 * Origins and pitch match the glabels US Letter definitions (the same grid Word's
 * built-in templates use). 5161, 5162, and 5163 share the two-column 4-inch pitch.
 */

export type AveryTemplateId = '5160' | '5161' | '5162' | '5163';

export type AveryTemplate = {
  id: AveryTemplateId;
  name: string;
  description: string;
  sizeLabel: string;
  columns: number;
  rows: number;
  labelWidth: number;
  labelHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  gapX: number;
  gapY: number;
};

export type MailingLabelContact = {
  firstName: string;
  lastName: string;
  mailingName: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

export type FittedLabel = {
  lines: string[];
  fontSizePt: number;
};

export type LabelMeasurer = (text: string, fontSizePt: number) => number;

export const LABEL_PAD_X = 0.1;
export const LABEL_PAD_TOP = 0.08;
export const LABEL_PAD_BOTTOM = 0.06;
export const LABEL_LINE_FACTOR = 1.2;

const LABEL_FONT_SIZES = [10, 9, 8, 7] as const;

export const AVERY_TEMPLATES: readonly AveryTemplate[] = [
  {
    id: '5160',
    name: 'Avery 5160',
    description: 'Standard address',
    sizeLabel: '1" × 2.625"',
    columns: 3,
    rows: 10,
    labelWidth: 2.625,
    labelHeight: 1,
    marginTop: 0.5,
    marginBottom: 0.5,
    marginLeft: 0.1875,
    marginRight: 0.1875,
    gapX: 0.125,
    gapY: 0,
  },
  {
    id: '5161',
    name: 'Avery 5161',
    description: 'Wider address',
    sizeLabel: '1" × 4"',
    columns: 2,
    rows: 10,
    labelWidth: 4,
    labelHeight: 1,
    marginTop: 0.5,
    marginBottom: 0.5,
    marginLeft: 0.15625,
    marginRight: 0.15625,
    gapX: 0.1875,
    gapY: 0,
  },
  {
    id: '5162',
    name: 'Avery 5162',
    description: 'Extra address lines',
    sizeLabel: '1 1/3" × 4"',
    columns: 2,
    rows: 7,
    labelWidth: 4,
    labelHeight: 4 / 3,
    marginTop: 5 / 6,
    marginBottom: 5 / 6,
    marginLeft: 0.15625,
    marginRight: 0.15625,
    gapX: 0.1875,
    gapY: 0,
  },
  {
    id: '5163',
    name: 'Avery 5163',
    description: 'Shipping',
    sizeLabel: '2" × 4"',
    columns: 2,
    rows: 5,
    labelWidth: 4,
    labelHeight: 2,
    marginTop: 0.5,
    marginBottom: 0.5,
    marginLeft: 0.15625,
    marginRight: 0.15625,
    gapX: 0.1875,
    gapY: 0,
  },
];

export function getAveryTemplate(id: AveryTemplateId): AveryTemplate {
  const template = AVERY_TEMPLATES.find((item) => item.id === id);
  if (!template) {
    throw new Error(`Unknown Avery template ${id}`);
  }
  return template;
}

export function labelsPerSheet(template: AveryTemplate): number {
  return template.columns * template.rows;
}

export function labelPitchX(template: AveryTemplate): number {
  return template.labelWidth + template.gapX;
}

export function labelPitchY(template: AveryTemplate): number {
  return template.labelHeight + template.gapY;
}

export function labelTextWidth(template: AveryTemplate): number {
  return template.labelWidth - LABEL_PAD_X * 2;
}

export function labelTextHeight(template: AveryTemplate): number {
  return template.labelHeight - LABEL_PAD_TOP - LABEL_PAD_BOTTOM;
}

export function labelLineHeightIn(fontSizePt: number): number {
  return (fontSizePt * LABEL_LINE_FACTOR) / 72;
}

export function averyLayoutError(template: AveryTemplate): string | null {
  const width =
    template.marginLeft +
    template.marginRight +
    template.columns * template.labelWidth +
    (template.columns - 1) * template.gapX;
  const height =
    template.marginTop +
    template.marginBottom +
    template.rows * template.labelHeight +
    (template.rows - 1) * template.gapY;
  if (Math.abs(width - 8.5) > 0.002 || Math.abs(height - 11) > 0.002) {
    return `${template.name} is ${width.toFixed(4)}" × ${height.toFixed(4)}", not US Letter`;
  }
  return null;
}

export function logicalLabelLines(
  contact: MailingLabelContact,
  options: { includeCountry?: boolean } = {}
): string[] | null {
  const addressee = [contact.firstName, contact.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
  const name = addressee || contact.mailingName.trim();
  const street = contact.streetAddress
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const cityState = [contact.city.trim(), contact.state.trim()].filter(Boolean).join(', ');
  const cityLine = [cityState, contact.zip.trim()].filter(Boolean).join(' ');
  const country = contact.country.trim();
  if (street.length === 0 && !cityLine) return null;

  const lines: string[] = [];
  if (name) lines.push(name);
  lines.push(...street);
  if (cityLine) lines.push(cityLine);
  if (options.includeCountry && country) lines.push(country);
  return lines;
}

export function prepareMailingLabels(contacts: readonly MailingLabelContact[]): MailingLabelContact[] {
  return contacts
    .filter((contact) => logicalLabelLines(contact) !== null)
    .slice()
    .sort((a, b) => labelSortKey(a).localeCompare(labelSortKey(b), undefined, { sensitivity: 'base' }));
}

export function fitLabelText(
  lines: string[],
  template: AveryTemplate,
  measure: LabelMeasurer
): FittedLabel {
  const maxWidth = labelTextWidth(template);
  const maxHeight = labelTextHeight(template);
  let wrapped: string[] = [];
  let fontSizePt: number = LABEL_FONT_SIZES[LABEL_FONT_SIZES.length - 1];

  for (const size of LABEL_FONT_SIZES) {
    fontSizePt = size;
    wrapped = wrapLogicalLines(lines, maxWidth, size, measure);
    if (wrapped.length * labelLineHeightIn(size) <= maxHeight + 0.001) {
      return { lines: wrapped, fontSizePt: size };
    }
  }

  const maxLines = Math.max(1, Math.floor((maxHeight + 0.001) / labelLineHeightIn(fontSizePt)));
  return { lines: wrapped.slice(0, maxLines), fontSizePt };
}

export function mailingLabelFilename(templateId: AveryTemplateId, extension: 'pdf' | 'docx', date = new Date()): string {
  const day = date.toISOString().split('T')[0];
  return `Address_Labels_${templateId}_${day}.${extension}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function labelSortKey(contact: MailingLabelContact): string {
  const addressee = [contact.lastName, contact.firstName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
  return `${addressee || contact.mailingName.trim()}\u0000${contact.mailingName.trim()}`;
}

function wrapLogicalLines(
  lines: string[],
  maxWidth: number,
  fontSizePt: number,
  measure: LabelMeasurer
): string[] {
  return lines.flatMap((line) => wrapOneLine(line, maxWidth, fontSizePt, measure));
}

function wrapOneLine(line: string, maxWidth: number, fontSizePt: number, measure: LabelMeasurer): string[] {
  const text = line.trim();
  if (!text) return [];
  if (measure(text, fontSizePt) <= maxWidth) return [text];

  const wrapped: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current) wrapped.push(current);
    current = '';
  };

  for (const word of text.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (measure(next, fontSizePt) <= maxWidth) {
      current = next;
      continue;
    }
    pushCurrent();
    if (measure(word, fontSizePt) <= maxWidth) {
      current = word;
      continue;
    }
    let chunk = '';
    for (const character of word) {
      const trial = chunk + character;
      if (chunk && measure(trial, fontSizePt) > maxWidth) {
        wrapped.push(chunk);
        chunk = character;
      } else {
        chunk = trial;
      }
    }
    current = chunk;
  }
  pushCurrent();
  return wrapped;
}
