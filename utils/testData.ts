/**
 * Test data factories for BSS Account Payable
 */

/** Login credentials interface */
export interface LoginCredentials {
  username: string;
  password: string;
  subscriberId: string;
}

/**
 * Default valid login credentials (override via env variables)
 */
export function getValidCredentials(): LoginCredentials {
  return {
    username: process.env.USERNAME || 'testuser',
    password: process.env.PASSWORD || 'TestPass123!',
    subscriberId: process.env.SUBSCRIBER_ID || 'BSSQA',
  };
}

/**
 * Invalid login credentials for negative tests
 */
export function getInvalidCredentials(): LoginCredentials {
  return {
    username: 'invaliduser',
    password: 'WrongPassword!',
    subscriberId: 'INVALID',
  };
}
