/**
 * QA Environment Configuration
 */

export interface EnvConfig {
  baseURL: string;
  username: string;
  password: string;
  subscriberId: string;
  apiBaseURL: string;
  timeout: number;
}

export function getEnvConfig(): EnvConfig {
  return {
    baseURL:
      process.env.BASE_URL ||
      'https://appqa.birchstreet.co/j4/default.jsp',
    username: process.env.USERNAME || '',
    password: process.env.PASSWORD || '',
    subscriberId: process.env.SUBSCRIBER_ID || '',
    apiBaseURL: process.env.API_BASE_URL || 'https://qa-api.birchstreet.net',
    timeout: Number(process.env.TIMEOUT) || 30000,
  };
}
