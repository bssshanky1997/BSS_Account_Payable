import { ApplicationSettingsApi, type DocumentSavePayload } from '../Common/applicationSettingsBaseApi';
import {
  applyTaxAuthoritySettingsToCasRow,
  buildCasDocumentSavePayloadFromLoadedDoc,
  getCasCompanyIdFromLoadedDoc,
  parseCompanyApplicationSettingDocumentLoad,
} from './API_Helper/casDocumentPatch';
import {
  buildTaxAuthorityLevelDocumentSavePayload,
  SHOW_TAX_LEVEL_FIELDS_VALUE,
  TAX_TYPE_TAX_AUTHORITY_LEVELS,
  type ShowTaxLevelFieldsOption,
  type TaxAuthorityLevelCasSettings,
  type TaxAuthorityLevelDocumentSaveOptions,
} from './API_Helper/taxAuthorityLevelPayload';

export {
  buildTaxAuthorityLevelDocumentSavePayload,
  SHOW_TAX_LEVEL_FIELDS_VALUE,
  TAX_TYPE_TAX_AUTHORITY_LEVELS,
  type ShowTaxLevelFieldsOption,
  type TaxAuthorityLevelCasSettings,
  type TaxAuthorityLevelDocumentSaveOptions,
};

export type ConfigureTaxAuthorityLevelOptions = {
  companyId?: string | number;
  subscriberId?: string | number;
  doctype?: string | number;
  /** CAS DocumentLoad documentNumber (usually company id). Defaults to CAS_COMPANY_DOCUMENT_NUMBER || TARGET_COMPANY_ID. */
  documentNumber?: string;
  /** When true, skip DocumentLoad and send a minimal constructed payload (legacy/fallback). */
  useMinimalPayload?: boolean;
};

export class CompanyApplicationSettingApi {
  private readonly api = new ApplicationSettingsApi();

  async init(): Promise<void> {
    await this.api.init();
  }

  async dispose(): Promise<void> {
    await this.api.dispose();
  }

  async load(documentNumber: string | number): Promise<string> {
    return this.api.loadCompanyApplicationSetting(documentNumber);
  }

  async save(payload: DocumentSavePayload): Promise<string> {
    return this.api.saveCompanyApplicationSetting(payload);
  }

  /**
   * Configure Tax Authority Level CAS flags via API (no UI).
   * Flow: DocumentLoad company CAS row → patch Tax Authority columns → DocumentSave.
   *
   * Requires valid auth session (`playwright/.auth/user.json`).
   * Defaults: DOC_ID_COMPANY_APPLICATION_SETTING=15249, TARGET_COMPANY_ID as documentNumber.
   */
  async configureTaxAuthorityLevel(
    settings: TaxAuthorityLevelCasSettings,
    options: ConfigureTaxAuthorityLevelOptions = {}
  ): Promise<string> {
    const companyId = String(options.companyId ?? process.env.TARGET_COMPANY_ID ?? '').trim();
    const subscriberId = String(options.subscriberId ?? process.env.SUBSCRIBER_ID ?? '').trim();
    if (!companyId) {
      throw new Error(
        'TARGET_COMPANY_ID (or options.companyId) is required to configure CAS Tax Authority Level via API.'
      );
    }
    if (!subscriberId) {
      throw new Error(
        'SUBSCRIBER_ID (or options.subscriberId) is required to configure CAS Tax Authority Level via API.'
      );
    }

    const doctype = options.doctype ?? this.api.getDocumentId('companyApplicationSetting');
    const documentNumber = String(
      options.documentNumber ??
        process.env.CAS_COMPANY_DOCUMENT_NUMBER ??
        companyId
    ).trim();

    if (options.useMinimalPayload || process.env.CAS_USE_MINIMAL_PAYLOAD === 'true') {
      const payload = buildTaxAuthorityLevelDocumentSavePayload({
        doctype,
        companyId,
        subscriberId,
        documentNumber,
        settings: {
          ...settings,
          taxType: settings.taxType ?? TAX_TYPE_TAX_AUTHORITY_LEVELS,
        },
      });
      return this.save(payload);
    }

    const loadXml = await this.load(documentNumber);
    const doc = parseCompanyApplicationSettingDocumentLoad(loadXml, doctype);
    const loadedCompanyId = getCasCompanyIdFromLoadedDoc(doc);
    if (!loadedCompanyId || loadedCompanyId === '0') {
      throw new Error(
        `CAS DocumentLoad for documentNumber=${documentNumber} returned empty/invalid COMPANY_ID="${loadedCompanyId}". ` +
          `Set CAS_COMPANY_DOCUMENT_NUMBER to the real company id used by Company Application Setting (Document ID ${doctype}).`
      );
    }

    const updatedRow = applyTaxAuthoritySettingsToCasRow(doc, settings);
    const payload = buildCasDocumentSavePayloadFromLoadedDoc(doc, updatedRow);
    return this.save(payload);
  }

  async setShowTaxLevelFields(
    option: ShowTaxLevelFieldsOption,
    options: ConfigureTaxAuthorityLevelOptions = {}
  ): Promise<string> {
    return this.configureTaxAuthorityLevel({ showTaxLevelFields: option }, options);
  }

  async setDepartmentForTaxAuthority(
    department: string | number | null,
    options: ConfigureTaxAuthorityLevelOptions = {}
  ): Promise<string> {
    return this.configureTaxAuthorityLevel({ departmentForTaxAuthority: department }, options);
  }

  async setUseTaxDepartmentForGlValidation(
    enabled: boolean,
    options: ConfigureTaxAuthorityLevelOptions = {}
  ): Promise<string> {
    return this.configureTaxAuthorityLevel({ useTaxDepartmentForGlValidation: enabled }, options);
  }

  async setTaxLevelIds(
    levels: {
      taxLevel1Id?: string | number | null;
      taxLevel2Id?: string | number | null;
      taxLevel3Id?: string | number | null;
      taxLevel4Id?: string | number | null;
    },
    options: ConfigureTaxAuthorityLevelOptions = {}
  ): Promise<string> {
    return this.configureTaxAuthorityLevel(levels, options);
  }
}
