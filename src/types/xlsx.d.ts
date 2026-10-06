// src/types/xlsx.d.ts

declare module 'xlsx' {
  export interface ParsingOptions {
    type?: 'base64' | 'binary' | 'buffer' | 'file' | 'array' | 'string';
    raw?: boolean;
    cellFormula?: boolean;
    cellHTML?: boolean;
    cellNF?: boolean;
    cellStyles?: boolean;
    cellText?: boolean;
    cellDates?: boolean;
    dateNF?: string;
    sheetRows?: number;
    bookDeps?: boolean;
    bookFiles?: boolean;
    bookProps?: boolean;
    bookSheets?: boolean;
    bookVBA?: boolean;
    password?: string;
    WTF?: boolean;
    [key: string]: any;
  }

  export interface WritingOptions {
    type?: 'base64' | 'binary' | 'buffer' | 'file' | 'array' | 'string';
    bookType?: 'xlsx' | 'xlsm' | 'xlsb' | 'biff8' | 'biff5' | 'biff2' | 'xlml' | 'ods' | 'fods' | 'csv' | 'txt' | 'sylk' | 'html' | 'dif' | 'rtf' | 'prn' | 'eth';
    bookSST?: boolean;
    compression?: boolean;
    Props?: any;
    themeXLSX?: string;
    ignoreEC?: boolean;
    [key: string]: any;
  }

  export interface WorkBook {
    SheetNames: string[];
    Sheets: { [sheet: string]: any };
    Props?: any;
    Custprops?: any;
    Workbook?: any;
    vbaraw?: any;
    [key: string]: any;
  }

  export interface WorkSheet {
    '!ref'?: string;
    '!cols'?: Array<{ wch?: number; width?: number; hidden?: boolean }>;
    '!rows'?: Array<{ hpt?: number; hpx?: number; hidden?: boolean }>;
    '!merges'?: any[];
    [cell: string]: any;
  }

  export interface Sheet2JSONOpts {
    header?: 'A' | number | string[];
    range?: any;
    blankrows?: boolean;
    defval?: any;
    raw?: boolean;
    rawNumbers?: boolean;
    dateNF?: string;
    [key: string]: any;
  }

  export interface XLSXUtils {
    book_new(): WorkBook;
    aoa_to_sheet(data: any[][], opts?: any): WorkSheet;
    sheet_to_json<T = any>(sheet: WorkSheet, opts?: Sheet2JSONOpts): T[];
    json_to_sheet(data: any[], opts?: any): WorkSheet;
    table_to_sheet(table: any, opts?: any): WorkSheet;
    table_to_book(table: any, opts?: any): WorkBook;
    book_append_sheet(wb: WorkBook, ws: WorkSheet, name?: string): void;
    sheet_to_csv(sheet: WorkSheet, opts?: any): string;
    sheet_to_txt(sheet: WorkSheet, opts?: any): string;
    sheet_to_html(sheet: WorkSheet, opts?: any): string;
    [key: string]: any;
  }

  export function read(data: any, opts?: ParsingOptions): WorkBook;
  export function write(data: WorkBook, opts?: WritingOptions): any;
  export function readFile(filename: string, opts?: ParsingOptions): WorkBook;
  export function writeFile(data: WorkBook, filename: string, opts?: WritingOptions): any;
  export function writeFileXLSX(data: WorkBook, filename: string, opts?: WritingOptions): any;
  export const utils: XLSXUtils;
  export const version: string;

  const XLSX: {
    read: typeof read;
    write: typeof write;
    readFile: typeof readFile;
    writeFile: typeof writeFile;
    writeFileXLSX: typeof writeFileXLSX;
    utils: XLSXUtils;
    version: string;
    [key: string]: any;
  };

  export default XLSX;
}
