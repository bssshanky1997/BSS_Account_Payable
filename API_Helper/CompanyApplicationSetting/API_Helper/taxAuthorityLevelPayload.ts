import type { DocumentSavePayload } from '../../Common/applicationSettingsBaseApi';

/** Show Tax Level Fields options used by CD-5191 / CAS. */
export type ShowTaxLevelFieldsOption =
  | 'Off'
  | 'Show 1 Field'
  | 'Show 2 Fields'
  | 'Show 3 Fields'
  | 'Show 4 Fields';

/** Maps UI labels to PSM_APP_SETTING_COMPANY.SHOW_TAX_LEVEL_FIELDS values. */
export const SHOW_TAX_LEVEL_FIELDS_VALUE: Record<ShowTaxLevelFieldsOption, string> = {
  Off: '0',
  'Show 1 Field': '1',
  'Show 2 Fields': '2',
  'Show 3 Fields': '3',
  'Show 4 Fields': '4',
};

/** CAS TAX_TYPE dropdown value for Tax Authority Levels. */
export const TAX_TYPE_TAX_AUTHORITY_LEVELS = '1';

export type TaxAuthorityLevelCasSettings = {
  /** Tax Type — Tax Authority Levels (override via CAS_TAX_TYPE_VALUE if tenant differs). */
  taxType?: string;
  showTaxLevelFields?: ShowTaxLevelFieldsOption | string;
  taxLevel1Id?: string | number | null;
  taxLevel2Id?: string | number | null;
  taxLevel3Id?: string | number | null;
  taxLevel4Id?: string | number | null;
  departmentForTaxAuthority?: string | number | null;
  useTaxDepartmentForGlValidation?: boolean | null;
};

export type TaxAuthorityLevelDocumentSaveOptions = {
  doctype: string | number;
  state?: string | number;
  documentNumber?: string;
  action?: 'I' | 'U' | 'D' | string;
  companyId: string | number;
  subscriberId: string | number;
  tableName?: string;
  settings: TaxAuthorityLevelCasSettings;
  additionalColumns?: Record<string, string | number | boolean | null | undefined>;
};

const DEFAULT_TABLE_NAME = 'PSM_APP_SETTING_COMPANY';

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const toCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? '1' : '0';
  return String(value);
};

const resolveShowTaxLevelFieldsValue = (option?: ShowTaxLevelFieldsOption | string): string | undefined => {
  if (option === undefined || option === null || option === '') return undefined;
  if (option in SHOW_TAX_LEVEL_FIELDS_VALUE) {
    return SHOW_TAX_LEVEL_FIELDS_VALUE[option as ShowTaxLevelFieldsOption];
  }
  return String(option);
};

const buildTableXml = (
  tableName: string,
  columns: Record<string, string | number | boolean | null | undefined>
): string => {
  const values = Object.values(columns).map((value) => `<c>${escapeXml(toCellValue(value))}</c>`).join('');
  const colCount = Object.keys(columns).length;
  return `<TABLE><${tableName}><COLCOUNT>${colCount}</COLCOUNT><ROWCOUNT>1</ROWCOUNT><ROW>${values}</ROW></${tableName}></TABLE>`;
};

/**
 * Build DocumentSave payload for Company Application Setting — Tax Authority Level flags.
 * Column names follow PSM_APP_SETTING_COMPANY conventions used by CD-5191.
 */
export const buildTaxAuthorityLevelDocumentSavePayload = (
  options: TaxAuthorityLevelDocumentSaveOptions
): DocumentSavePayload => {
  const {
    doctype,
    state = '1',
    action = 'U',
    documentNumber = 'Nothing',
    companyId,
    subscriberId,
    tableName = DEFAULT_TABLE_NAME,
    settings,
    additionalColumns = {},
  } = options;

  const showTaxLevelFields = resolveShowTaxLevelFieldsValue(settings.showTaxLevelFields);
  const taxType = settings.taxType
    ? String(settings.taxType).trim()
    : String(process.env.CAS_TAX_TYPE_VALUE || '1').trim() || '1';
  const normalizedTaxType = /tax authority/i.test(taxType) ? '1' : taxType;

  const rowColumns: Record<string, string | number | boolean | null | undefined> = {
    COMPANY_ID: companyId,
    SUBSCRIBER_ID: subscriberId,
    TAX_TYPE: normalizedTaxType,
  };

  if (showTaxLevelFields !== undefined) {
    rowColumns.SHOW_TAX_LEVEL_FIELDS = showTaxLevelFields;
  }
  if (settings.taxLevel1Id !== undefined) {
    rowColumns.TAX_LEVEL_1_AUTHORITY_ID = settings.taxLevel1Id;
  }
  if (settings.taxLevel2Id !== undefined) {
    rowColumns.TAX_LEVEL_2_AUTHORITY_ID = settings.taxLevel2Id;
  }
  if (settings.taxLevel3Id !== undefined) {
    rowColumns.TAX_LEVEL_3_AUTHORITY_ID = settings.taxLevel3Id;
  }
  if (settings.taxLevel4Id !== undefined) {
    rowColumns.TAX_LEVEL_4_AUTHORITY_ID = settings.taxLevel4Id;
  }
  if (settings.departmentForTaxAuthority !== undefined) {
    rowColumns.TAX_AUTH_DEPT = settings.departmentForTaxAuthority;
  }
  if (settings.useTaxDepartmentForGlValidation !== undefined && settings.useTaxDepartmentForGlValidation !== null) {
    rowColumns.USE_TAX_AUTH_DEPT_FOR_GL_CHECK = settings.useTaxDepartmentForGlValidation ? '1' : '0';
  }

  Object.assign(rowColumns, additionalColumns);

  const xml =
    `<DOC_ROOT><DOC_COUNT>1</DOC_COUNT><NEW_DOC><DOCUMENT>` +
    `<DOCMETA><NAME>Company Application Setting</NAME><DOCUMENT_ID>${escapeXml(String(doctype))}</DOCUMENT_ID>` +
    `<DOCUMENT_STATE>${escapeXml(String(state))}</DOCUMENT_STATE><FULLXMLDOC>true</FULLXMLDOC><TABLECOUNT>1</TABLECOUNT></DOCMETA>` +
    buildTableXml(tableName, rowColumns) +
    `<PBUTTON></PBUTTON></DOCUMENT></NEW_DOC></DOC_ROOT>`;

  return {
    doctype,
    state,
    action,
    documentNumber,
    xml,
  };
};
