import { ApplicationSettingsApi, type DocumentSavePayload } from '../Common/applicationSettingsBaseApi';
import {
  buildIntegrationParameter932DocumentSavePayload,
  buildIntegrationParameter932JsonPayload,
  INTEGRATION_PARAMETER_ID_932,
  type IntegrationParameter932DocumentSaveOptions,
  type IntegrationParameter932JsonPayload,
} from './API_Helper/integrationParameter932Payload';

export {
  buildIntegrationParameter932DocumentSavePayload,
  buildIntegrationParameter932JsonPayload,
  INTEGRATION_PARAMETER_ID_932,
  type IntegrationParameter932DocumentSaveOptions,
  type IntegrationParameter932JsonPayload,
};

export type SetParam932Options = {
  companyId?: string | number;
  subscriberId?: string | number;
  doctype?: string | number;
  documentNumber?: string;
};

export class IntegrationParameterApi {
  private readonly api = new ApplicationSettingsApi();

  async init(): Promise<void> {
    await this.api.init();
  }

  async dispose(): Promise<void> {
    await this.api.dispose();
  }

  async load(documentNumber: string | number): Promise<string> {
    return this.api.loadIntegrationParameter(documentNumber);
  }

  async save(payload: DocumentSavePayload): Promise<string> {
    return this.api.saveIntegrationParameter(payload);
  }

  /**
   * Turn Integration Parameter 932 ON/OFF via DocumentSave API (no UI).
   * Defaults: TARGET_COMPANY_ID, SUBSCRIBER_ID, DOC_ID_INTEGRATION_PARAMETER from env.
   */
  async setParam932(isActive: boolean, options: SetParam932Options = {}): Promise<string> {
    const companyId = String(options.companyId ?? process.env.TARGET_COMPANY_ID ?? '').trim();
    const subscriberId = String(options.subscriberId ?? process.env.SUBSCRIBER_ID ?? '').trim();
    if (!companyId) {
      throw new Error('TARGET_COMPANY_ID (or options.companyId) is required to set Param 932 via API.');
    }
    if (!subscriberId) {
      throw new Error('SUBSCRIBER_ID (or options.subscriberId) is required to set Param 932 via API.');
    }

    const doctype = options.doctype ?? this.api.getDocumentId('integrationParameter');
    const payload = buildIntegrationParameter932DocumentSavePayload({
      doctype,
      companyId,
      subscriberId,
      documentNumber: options.documentNumber,
      activeValue: isActive ? '1' : '0',
    });

    return this.save(payload);
  }
}
