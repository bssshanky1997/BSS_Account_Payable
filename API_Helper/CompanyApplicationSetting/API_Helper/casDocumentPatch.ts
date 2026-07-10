import type { DocumentSavePayload } from '../../Common/applicationSettingsBaseApi';
import {
  SHOW_TAX_LEVEL_FIELDS_VALUE,
  type ShowTaxLevelFieldsOption,
  type TaxAuthorityLevelCasSettings,
} from './taxAuthorityLevelPayload';

export type LoadedCasTable = {
  tableName: string;
  colCount: number;
  columnNames: string[];
  rows: string[][];
};

export type LoadedCasDocument = {
  docName: string;
  documentId: string;
  stateId: string;
  tableName: string;
  colCount: number;
  row: string[];
  columnNames: string[];
  tables: LoadedCasTable[];
  rawResponse: string;
};

const DEFAULT_TABLE_NAME = 'PSM_APP_SETTING_COMPANY';

/** Tax Type value for "Tax Authority Levels" in CAS (TAX_TYPE dropdown). */
export const TAX_TYPE_TAX_AUTHORITY_LEVELS = '1';

const decodeJsString = (value: string): string =>
  value.replace(/\\\\/g, '\\').replace(/\\"/g, '"').replace(/\\\//g, '/');

const parseDelimitedRow = (value: string): string[] =>
  decodeJsString(value)
    .split('~;~')
    .filter((part, index, arr) => !(index === arr.length - 1 && part === ''));

const extractSingle = (re: RegExp, source: string, label: string): string => {
  const match = source.match(re);
  if (!match?.[1]) {
    throw new Error(`Unable to parse ${label} from Company Application Setting DocumentLoad response.`);
  }
  return match[1];
};

const extractSingleOrDefault = (re: RegExp, source: string, fallback: string): string => {
  const match = source.match(re);
  return match?.[1] || fallback;
};

const xmlEscape = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const buildTableXml = (tableName: string, colCount: number, rows: string[][]): string => {
  const rowXml = rows
    .map((row) => {
      const cells = Array.from({ length: colCount }, (_, i) => `<c>${xmlEscape(row[i] ?? '')}</c>`).join('');
      return `<ROW>${cells}</ROW>`;
    })
    .join('');
  return `<TABLE><${tableName}><COLCOUNT>${colCount}</COLCOUNT><ROWCOUNT>${rows.length}</ROWCOUNT>${rowXml}</${tableName}></TABLE>`;
};

const resolveShowTaxLevelFieldsValue = (option?: ShowTaxLevelFieldsOption | string): string | undefined => {
  if (option === undefined || option === null || option === '') return undefined;
  if (option in SHOW_TAX_LEVEL_FIELDS_VALUE) {
    return SHOW_TAX_LEVEL_FIELDS_VALUE[option as ShowTaxLevelFieldsOption];
  }
  return String(option);
};

const normalizeName = (name: string): string => name.replace(/[^A-Z0-9]/gi, '').toUpperCase();

const COLUMN_ALIASES: Record<keyof TaxAuthorityLevelCasSettings | 'taxType', string[]> = {
  taxType: ['TAX_TYPE'],
  showTaxLevelFields: ['SHOW_TAX_LEVEL_FIELDS'],
  taxLevel1Id: ['TAX_LEVEL_1_AUTHORITY_ID'],
  taxLevel2Id: ['TAX_LEVEL_2_AUTHORITY_ID'],
  taxLevel3Id: ['TAX_LEVEL_3_AUTHORITY_ID'],
  taxLevel4Id: ['TAX_LEVEL_4_AUTHORITY_ID'],
  departmentForTaxAuthority: ['TAX_AUTH_DEPT'],
  useTaxDepartmentForGlValidation: ['USE_TAX_AUTH_DEPT_FOR_GL_CHECK'],
};

const ENV_COLUMN_INDEX: Partial<Record<keyof typeof COLUMN_ALIASES, string>> = {
  taxType: 'CAS_COL_TAX_TYPE',
  showTaxLevelFields: 'CAS_COL_SHOW_TAX_LEVEL_FIELDS',
  taxLevel1Id: 'CAS_COL_TAX_LEVEL_1_ID',
  taxLevel2Id: 'CAS_COL_TAX_LEVEL_2_ID',
  taxLevel3Id: 'CAS_COL_TAX_LEVEL_3_ID',
  taxLevel4Id: 'CAS_COL_TAX_LEVEL_4_ID',
  departmentForTaxAuthority: 'CAS_COL_DEPARTMENT_FOR_TAX_AUTHORITY',
  useTaxDepartmentForGlValidation: 'CAS_COL_USE_TAX_DEPT_FOR_GL_VALIDATION',
};

const parseFieldNames = (source: string, tableName: string, colCount: number): string[] => {
  const fieldNameList = source.match(
    new RegExp(`${tableName}\\.SetFieldNameByList\\("([\\s\\S]*?)"\\s*,\\s*"~;~"\\)`, 'i')
  );
  if (fieldNameList?.[1]) {
    const names = parseDelimitedRow(fieldNameList[1]);
    if (names.length > 0) return names;
  }
  return Array.from({ length: colCount }, (_, i) => `COL_${i}`);
};

const parseAllTables = (source: string): LoadedCasTable[] => {
  const tableNames = [...source.matchAll(/var\s+([A-Z0-9_]+)\s*=\s*new\s+RSObject\((\d+),/g)].map((m) => ({
    tableName: m[1],
    colCount: Number(m[2]),
  }));

  return tableNames.map(({ tableName, colCount }) => {
    const columnNames = parseFieldNames(source, tableName, colCount);
    const rowRe = new RegExp(`${tableName}\\.SetByList\\("([\\s\\S]*?)",\\s*"~;~"\\)`, 'g');
    const rows: string[][] = [];
    let match: RegExpExecArray | null;
    while ((match = rowRe.exec(source)) !== null) {
      const row = parseDelimitedRow(match[1]);
      while (row.length < colCount) row.push('');
      rows.push(row.slice(0, colCount));
    }
    if (rows.length === 0) {
      rows.push(Array.from({ length: colCount }, () => ''));
    }
    return { tableName, colCount, columnNames, rows };
  });
};

export const parseCompanyApplicationSettingDocumentLoad = (
  responseText: string,
  fallbackDocumentId: string | number
): LoadedCasDocument => {
  if (!/DocDataObject|RSObject|SetByList|SetFieldNameByList/i.test(responseText)) {
    throw new Error(
      'Company Application Setting DocumentLoad did not return document data. Re-login / refresh playwright/.auth/user.json and verify DOC_ID_COMPANY_APPLICATION_SETTING.'
    );
  }

  const docName = extractSingleOrDefault(
    /new\s+DocDataObject\(\d+,\s*"([^"]+)"\)/,
    responseText,
    'Company Application Setting'
  );
  const documentId = extractSingleOrDefault(
    /DOCTYPE:(\d+)/,
    responseText,
    extractSingleOrDefault(/var\s+gDocID\s*=\s*"(\d+)"/, responseText, String(fallbackDocumentId))
  );
  const stateId = extractSingleOrDefault(/DOCUMENT_STATE[^>]*>\s*([0-9]+)/, responseText, '1');
  const tables = parseAllTables(responseText);
  const main =
    tables.find((t) => t.tableName === (process.env.CAS_TABLE_NAME || DEFAULT_TABLE_NAME)) || tables[0];
  if (!main) {
    throw new Error('No RSObject tables found in CAS DocumentLoad response.');
  }

  return {
    docName,
    documentId,
    stateId,
    tableName: main.tableName,
    colCount: main.colCount,
    row: [...main.rows[0]],
    columnNames: main.columnNames,
    tables,
    rawResponse: responseText,
  };
};

const resolveColumnIndex = (
  doc: LoadedCasDocument,
  field: keyof typeof COLUMN_ALIASES
): number | undefined => {
  const envName = ENV_COLUMN_INDEX[field];
  if (envName) {
    const raw = process.env[envName];
    if (raw !== undefined && String(raw).trim() !== '') {
      const idx = Number(raw);
      if (Number.isFinite(idx) && idx >= 0) return idx;
    }
  }

  const aliases = COLUMN_ALIASES[field].map(normalizeName);
  for (let i = 0; i < doc.columnNames.length; i += 1) {
    if (aliases.includes(normalizeName(doc.columnNames[i] || ''))) return i;
  }
  return undefined;
};

const resolveTaxTypeValue = (settings: TaxAuthorityLevelCasSettings): string => {
  if (settings.taxType !== undefined && settings.taxType !== null && String(settings.taxType).trim() !== '') {
    const raw = String(settings.taxType).trim();
    if (/tax authority/i.test(raw)) return TAX_TYPE_TAX_AUTHORITY_LEVELS;
    return raw;
  }
  const fromEnv = String(process.env.CAS_TAX_TYPE_VALUE || TAX_TYPE_TAX_AUTHORITY_LEVELS).trim();
  if (/tax authority/i.test(fromEnv)) return TAX_TYPE_TAX_AUTHORITY_LEVELS;
  return fromEnv || TAX_TYPE_TAX_AUTHORITY_LEVELS;
};

export const applyTaxAuthoritySettingsToCasRow = (
  doc: LoadedCasDocument,
  settings: TaxAuthorityLevelCasSettings
): string[] => {
  const row = [...doc.row];
  while (row.length < doc.colCount) row.push('');

  const setField = (field: keyof typeof COLUMN_ALIASES, value: string) => {
    const index = resolveColumnIndex(doc, field);
    if (index === undefined) {
      throw new Error(
        `Unable to resolve CAS column for "${field}". Expected one of: ${COLUMN_ALIASES[field].join(', ')}.`
      );
    }
    row[index] = value;
  };

  const touchesTaxAuthority =
    settings.taxType !== undefined ||
    settings.showTaxLevelFields !== undefined ||
    settings.taxLevel1Id !== undefined ||
    settings.taxLevel2Id !== undefined ||
    settings.taxLevel3Id !== undefined ||
    settings.taxLevel4Id !== undefined ||
    settings.departmentForTaxAuthority !== undefined ||
    settings.useTaxDepartmentForGlValidation !== undefined;

  if (touchesTaxAuthority) {
    setField('taxType', resolveTaxTypeValue(settings));
  }
  if (settings.showTaxLevelFields !== undefined) {
    const value = resolveShowTaxLevelFieldsValue(settings.showTaxLevelFields);
    if (value !== undefined) setField('showTaxLevelFields', value);
  }
  if (settings.taxLevel1Id !== undefined) setField('taxLevel1Id', String(settings.taxLevel1Id ?? ''));
  if (settings.taxLevel2Id !== undefined) setField('taxLevel2Id', String(settings.taxLevel2Id ?? ''));
  if (settings.taxLevel3Id !== undefined) setField('taxLevel3Id', String(settings.taxLevel3Id ?? ''));
  if (settings.taxLevel4Id !== undefined) setField('taxLevel4Id', String(settings.taxLevel4Id ?? ''));
  if (settings.departmentForTaxAuthority !== undefined) {
    setField('departmentForTaxAuthority', String(settings.departmentForTaxAuthority ?? ''));
  }
  if (settings.useTaxDepartmentForGlValidation !== undefined && settings.useTaxDepartmentForGlValidation !== null) {
    setField('useTaxDepartmentForGlValidation', settings.useTaxDepartmentForGlValidation ? '1' : '0');
  }

  return row.slice(0, doc.colCount);
};

export const buildCasDocumentSavePayloadFromLoadedDoc = (
  doc: LoadedCasDocument,
  updatedMainRow: string[]
): DocumentSavePayload => {
  // Main-table-only XML returns HTTP 500. Include every loaded table.
  // Preserve child rows (e.g. PSM_APP_SET_COMPANY_DETAIL); only clear change-history.
  const tableXml = doc.tables
    .map((table) => {
      if (table.tableName === doc.tableName) {
        return buildTableXml(table.tableName, table.colCount, [updatedMainRow.slice(0, table.colCount)]);
      }
      if (/CHG_HIST$/i.test(table.tableName)) {
        return buildTableXml(table.tableName, table.colCount, []);
      }
      return buildTableXml(table.tableName, table.colCount, table.rows);
    })
    .join('');

  const xml =
    `<DOC_ROOT><DOC_COUNT>1</DOC_COUNT><NEW_DOC><DOCUMENT>` +
    `<DOCMETA><NAME>${xmlEscape(doc.docName)}</NAME><DOCUMENT_ID>${xmlEscape(doc.documentId)}</DOCUMENT_ID>` +
    `<DOCUMENT_STATE>${xmlEscape(doc.stateId)}</DOCUMENT_STATE><FULLXMLDOC>true</FULLXMLDOC>` +
    `<TABLECOUNT>${doc.tables.length}</TABLECOUNT></DOCMETA>` +
    tableXml +
    `<PBUTTON></PBUTTON></DOCUMENT></NEW_DOC></DOC_ROOT>`;

  // BSS DocumentSave for CAS updates uses documentNumber=Nothing (same as Position Rights).
  // Override with CAS_SAVE_DOCUMENT_NUMBER only if a tenant requires the company id.
  const saveDocumentNumber = String(process.env.CAS_SAVE_DOCUMENT_NUMBER || 'Nothing').trim() || 'Nothing';

  return {
    doctype: doc.documentId,
    state: doc.stateId,
    action: 'U',
    documentNumber: saveDocumentNumber,
    xml,
  };
};

export const getCasCompanyIdFromLoadedDoc = (doc: LoadedCasDocument): string => {
  const idx = doc.columnNames.findIndex((name) => normalizeName(name) === 'COMPANYID');
  if (idx < 0) return '';
  return String(doc.row[idx] ?? '').trim();
};
