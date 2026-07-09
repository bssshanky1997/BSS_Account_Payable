export const APPLICATION_SETTINGS_SCREEN_ID = {
  companyApplicationSetting: 10292,
  integrationParameter: 10806,
  positionRightId: 10267,
  marketplaceApplicationSetting: 10291,
  companyApplicationSetting2: 11512,
} as const;

export type ApplicationSettingsScreenKey = keyof typeof APPLICATION_SETTINGS_SCREEN_ID;

export const APPLICATION_SETTINGS_SCREEN_NAME: Record<
  ApplicationSettingsScreenKey,
  string
> = {
  companyApplicationSetting: 'Company Application Setting',
  integrationParameter: 'Integration Parameter',
  positionRightId: 'Position (Right ID)',
  marketplaceApplicationSetting: 'Marketplace Application Setting',
  companyApplicationSetting2: 'Company Application Setting 2',
};

const readDocumentId = (envName: string, fallback?: number): number | undefined => {
  const raw = process.env[envName];
  if (!raw && fallback !== undefined) return fallback;
  if (!raw) return undefined;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const APPLICATION_SETTINGS_DOCUMENT_ID: Partial<
  Record<ApplicationSettingsScreenKey, number>
> = {
  // Known defaults from current automation setup; override via env when needed.
  integrationParameter: readDocumentId('DOC_ID_INTEGRATION_PARAMETER', 28),
  positionRightId: readDocumentId('DOC_ID_POSITION_RIGHT', 15630),

  // Confirmed from CAS screen 10292 / DocumentLoad (QA): document id 15249.
  companyApplicationSetting: readDocumentId('DOC_ID_COMPANY_APPLICATION_SETTING', 15249),
  marketplaceApplicationSetting: readDocumentId('DOC_ID_MARKETPLACE_APPLICATION_SETTING'),
  companyApplicationSetting2: readDocumentId('DOC_ID_COMPANY_APPLICATION_SETTING_2'),
};
