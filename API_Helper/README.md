# API Helper Structure

Use this folder as feature-first API helpers with a shared common layer.

## Folders

- `Common`: shared low-level API client and screen/document registry
- `CompanyApplicationSetting`: wrapper for company application setting APIs
- `CompanyApplicationSetting2`: wrapper for company application setting 2 APIs
- `IntegrationParameter`: wrapper for integration parameter APIs
- `Position`: wrapper for position-related APIs
- `MarketplaceApplicationSetting`: wrapper for marketplace application setting APIs

## Usage Pattern

1. Create feature helper instance (for example `new PositionApi()`).
2. Call `init()`.
3. Call `load()` / `save()`.
4. Call `dispose()` in `finally`.

## Integration Parameter 932 (CD-5191)

Toggle Param 932 **via API only** (no UI):

```ts
import { IntegrationParameterApi } from './API_Helper/IntegrationParameter';

const api = new IntegrationParameterApi();
await api.init();
try {
  await api.setParam932(true);  // ON
  await api.setParam932(false); // OFF
} finally {
  await api.dispose();
}
```

Requires `.env`: `TARGET_COMPANY_ID`, `SUBSCRIBER_ID`, `DOC_ID_INTEGRATION_PARAMETER` (default 28).

## Company Application Setting — Tax Authority Level (CD-5191)

Configure CAS Tax Authority flags **via API only** (no UI).

Preferred flow (same pattern as Position Rights):

1. `DocumentLoad` company CAS document
2. Patch Tax Authority columns on the loaded row
3. `DocumentSave`

```ts
import { CompanyApplicationSettingApi } from './API_Helper/CompanyApplicationSetting';

const api = new CompanyApplicationSettingApi();
await api.init();
try {
  await api.configureTaxAuthorityLevel({
    showTaxLevelFields: 'Show 4 Fields',
    departmentForTaxAuthority: 'D1',
    useTaxDepartmentForGlValidation: true,
    taxLevel1Id: 'STATE',
  });
  await api.setShowTaxLevelFields('Off');
} finally {
  await api.dispose();
}
```

Requires `.env`:

- `TARGET_COMPANY_ID`
- `SUBSCRIBER_ID`
- `DOC_ID_COMPANY_APPLICATION_SETTING` (QA default `15249`)
- `CAS_COMPANY_DOCUMENT_NUMBER` (CAS DocumentLoad company id — may differ from `TARGET_COMPANY_ID`; QA example `55396`)
- Valid `playwright/.auth/user.json` (run global setup / `npm run debug:login`)

Optional:

- `CAS_TAX_TYPE_VALUE` (default `1` = Tax Authority Levels)
- `CAS_TABLE_NAME` if table is not auto-detected
- `CAS_COL_SHOW_TAX_LEVEL_FIELDS`, `CAS_COL_TAX_LEVEL_1_ID`, ... (0-based indexes if column names are not in DocumentLoad)
- `CAS_USE_MINIMAL_PAYLOAD=true` to skip load-patch and send minimal constructed XML (legacy fallback; usually fails with HTTP 500)

Notes:

- DocumentSave must include **all** CAS tables from DocumentLoad (main-table-only XML returns HTTP 500).
- Child rows are preserved; only `*_CHG_HIST` is sent empty.
- Save uses `documentNumber=Nothing` (same as Position Rights).
