import { ASSIGNMENT_COLUMNS, type AssignmentColumn } from "./columns";
import { mapHeaders } from "./headers";
import type { SheetData } from "./xlsx-reader";

export type ParsedAssignmentRow = {
  row: number;
  sicilNo: string;
  staffName: string;
  tableLabels: string[];
  group: string;
  shift: string;
  role: string;
};

/** Masa etiketleri hücresi `,` `;` `|` ya da satır sonuyla ayrılır. */
export function splitLabels(cell: string): string[] {
  return cell
    .split(/[,;|\n\r]+/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

export function parseAssignmentRows(sheet: SheetData): ParsedAssignmentRow[] {
  const columns = mapHeaders(sheet.headers, ASSIGNMENT_COLUMNS);
  const get = (cells: string[], key: AssignmentColumn): string => {
    const index = columns.get(key);
    return index === undefined ? "" : (cells[index] ?? "");
  };
  return sheet.rows.map(({ row, cells }) => ({
    row,
    sicilNo: get(cells, "sicilNo"),
    staffName: get(cells, "staffName"),
    tableLabels: splitLabels(get(cells, "tables")),
    group: get(cells, "group"),
    shift: get(cells, "shift"),
    role: get(cells, "role"),
  }));
}
