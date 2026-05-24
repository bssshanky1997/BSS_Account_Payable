/**
 * Application-wide constants for BSS Account Payable
 */

/** Navigation URLs (relative to baseURL) */
export const URLS = {
  LOGIN: '/Login.aspx',
  /** BirchStreet J4 web login entry */
  J4_LOGIN: '/j4/login.jsp',
  DASHBOARD: '/Dashboard.aspx',
} as const;

/** Match current URL pathname for this route (optional `?` or `#` after path). */
export function urlPathEndsWith(routePath: string): RegExp {
  const escaped = routePath.replace(/[/.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}([?#]|$)`, 'i');
}

/** Default timeouts (ms) */
export const TIMEOUTS = {
  SHORT: 5_000,
  MEDIUM: 15_000,
  LONG: 30_000,
  PAGE_LOAD: 60_000,
  FILE_UPLOAD: 120_000,
} as const;

/** Common selectors shared across pages */
export const COMMON_SELECTORS = {
  LOADER: '.loading-overlay',
  TOAST_SUCCESS: '.toast-success',
  TOAST_ERROR: '.toast-error',
  MODAL_DIALOG: '.modal-dialog',
  CONFIRM_BUTTON: '#btnConfirm',
  CANCEL_BUTTON: '#btnCancel',
} as const;

/** Test tags */
export const TAGS = {
  REGRESSION: '@regression',
  LOGIN: '@login',
  AP: '@ap',
} as const;
