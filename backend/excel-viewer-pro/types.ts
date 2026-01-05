
export interface ExcelDataRow {
  [key: string]: any;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}
