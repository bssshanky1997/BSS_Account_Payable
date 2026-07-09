import { request, type APIRequestContext, type APIResponse } from '@playwright/test';
import {
  APPLICATION_SETTINGS_DOCUMENT_ID,
  APPLICATION_SETTINGS_SCREEN_ID,
  type ApplicationSettingsScreenKey,
} from './screenRegistry';

const DEFAULT_BASE_URL = 'https://appqa.birchstreet.co';
const DEFAULT_DOCUMENT_LOAD_XML = '<FOREIGN_KEY_DESC></FOREIGN_KEY_DESC>';

type ScreenSelector = ApplicationSettingsScreenKey | number;

export type DocumentLoadPayload = {
  documentNumber: string | number;
  documentID: string | number;
  StateID?: string | number;
  loadXML?: string;
  doLoad?: string | number;
};

export type DocumentSavePayload = {
  doctype: string | number;
  xml: string;
  state?: string | number;
  action?: 'I' | 'U' | 'D' | string;
  documentNumber?: string;
  rowInEditing?: string;
  columnInEditing?: string;
  xmlCompressed?: string | number;
  xmlOriginalSize?: string | number;
};

export class ApplicationSettingsApi {
  private apiContext?: APIRequestContext;

  async init(): Promise<void> {
    const baseUrl = String(process.env.BASE_URL || DEFAULT_BASE_URL).trim();
    this.apiContext = await request.newContext({
      baseURL: new URL('/j4/', baseUrl).toString(),
      storageState: 'playwright/.auth/user.json',
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        Accept: '*/*',
      },
      timeout: 60_000,
    });
  }

  async dispose(): Promise<void> {
    await this.apiContext?.dispose();
  }

  getScreenId(screenKey: ApplicationSettingsScreenKey): number {
    return APPLICATION_SETTINGS_SCREEN_ID[screenKey];
  }

  getScreenUrl(screenKey: ApplicationSettingsScreenKey): string {
    return `agscreen.jsp?screenid=${this.getScreenId(screenKey)}`;
  }

  async openScreen(screenKey: ApplicationSettingsScreenKey): Promise<APIResponse> {
    const ctx = this.ensureContext();
    return ctx.get(this.getScreenUrl(screenKey));
  }

  async openByScreenId(screenId: number): Promise<APIResponse> {
    const ctx = this.ensureContext();
    return ctx.get(`agscreen.jsp?screenid=${screenId}`);
  }

  async fetchCsrfToken(screen: ScreenSelector): Promise<string> {
    const screenId = this.resolveScreenId(screen);
    const response = await this.openByScreenId(screenId);
    if (!response.ok()) {
      throw new Error(`Unable to open screen ${screenId} for csrf token: ${response.status()}`);
    }

    const html = await response.text();
    const tokenMatch = html.match(/csrf_xyz123=([a-f0-9]{20,})/i);
    if (!tokenMatch?.[1]) {
      throw new Error(`csrf token not found for screen ${screenId}.`);
    }
    return tokenMatch[1];
  }

  async documentLoad(payload: DocumentLoadPayload): Promise<string> {
    const ctx = this.ensureContext();
    const response = await ctx.post('DocumentLoad.jsp', {
      form: {
        documentNumber: String(payload.documentNumber),
        documentID: String(payload.documentID),
        StateID: String(payload.StateID ?? '1'),
        loadXML: payload.loadXML ?? DEFAULT_DOCUMENT_LOAD_XML,
        doLoad: String(payload.doLoad ?? '1'),
      },
    });

    if (!response.ok()) {
      throw new Error(`DocumentLoad failed: ${response.status()} ${response.statusText()}`);
    }

    return response.text();
  }

  async documentSave(screen: ScreenSelector, payload: DocumentSavePayload): Promise<string> {
    const ctx = this.ensureContext();
    const csrfToken = await this.fetchCsrfToken(screen);
    const response = await ctx.post('DocumentSave.jsp', {
      form: {
        doctype: String(payload.doctype),
        xml: payload.xml,
        state: String(payload.state ?? '1'),
        action: payload.action ?? 'U',
        documentNumber: payload.documentNumber ?? 'Nothing',
        csrf_xyz123: csrfToken,
        rowInEditing: payload.rowInEditing ?? '',
        columnInEditing: payload.columnInEditing ?? '',
        xmlCompressed: String(payload.xmlCompressed ?? '0'),
        xmlOriginalSize: String(payload.xmlOriginalSize ?? ''),
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const responseText = await response.text();
    const snippet = responseText.replace(/\s+/g, ' ').slice(0, 500);
    if (!response.ok()) {
      throw new Error(
        `DocumentSave failed: ${response.status()} ${response.statusText()} (doctype=${payload.doctype}, action=${payload.action ?? 'U'})\n${snippet}`
      );
    }
    if (/Internal Server Error|saveStatus\s*=\s*"false"|Unhandled error/i.test(responseText)) {
      throw new Error(`DocumentSave returned non-success response.\n${snippet}`);
    }

    return responseText;
  }

  async loadCompanyApplicationSetting(
    documentNumber: string | number,
    documentID: string | number = this.getDocumentId('companyApplicationSetting')
  ): Promise<string> {
    return this.documentLoad({
      documentNumber,
      documentID,
    });
  }

  async saveCompanyApplicationSetting(payload: DocumentSavePayload): Promise<string> {
    return this.documentSave('companyApplicationSetting', payload);
  }

  async loadIntegrationParameter(
    documentNumber: string | number,
    documentID: string | number = this.getDocumentId('integrationParameter')
  ): Promise<string> {
    return this.documentLoad({
      documentNumber,
      documentID,
    });
  }

  async saveIntegrationParameter(payload: DocumentSavePayload): Promise<string> {
    return this.documentSave('integrationParameter', payload);
  }

  async loadPositionRight(
    documentNumber: string | number,
    documentID: string | number = this.getDocumentId('positionRightId')
  ): Promise<string> {
    return this.documentLoad({
      documentNumber,
      documentID,
    });
  }

  async savePositionRight(payload: DocumentSavePayload): Promise<string> {
    return this.documentSave('positionRightId', payload);
  }

  async loadMarketplaceApplicationSetting(
    documentNumber: string | number,
    documentID: string | number = this.getDocumentId('marketplaceApplicationSetting')
  ): Promise<string> {
    return this.documentLoad({
      documentNumber,
      documentID,
    });
  }

  async saveMarketplaceApplicationSetting(payload: DocumentSavePayload): Promise<string> {
    return this.documentSave('marketplaceApplicationSetting', payload);
  }

  async loadCompanyApplicationSetting2(
    documentNumber: string | number,
    documentID: string | number = this.getDocumentId('companyApplicationSetting2')
  ): Promise<string> {
    return this.documentLoad({
      documentNumber,
      documentID,
    });
  }

  getDocumentId(screenKey: ApplicationSettingsScreenKey): number {
    const documentId = APPLICATION_SETTINGS_DOCUMENT_ID[screenKey];
    if (!documentId) {
      throw new Error(
        `Document ID not configured for "${screenKey}". Please set the matching DOC_ID_* env variable.`
      );
    }
    return documentId;
  }

  async saveCompanyApplicationSetting2(payload: DocumentSavePayload): Promise<string> {
    return this.documentSave('companyApplicationSetting2', payload);
  }

  private resolveScreenId(screen: ScreenSelector): number {
    if (typeof screen === 'number') {
      return screen;
    }
    return this.getScreenId(screen);
  }

  private ensureContext(): APIRequestContext {
    if (!this.apiContext) {
      throw new Error('ApplicationSettingsApi not initialized. Call init() first.');
    }
    return this.apiContext;
  }
}
