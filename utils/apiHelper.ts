import { APIRequestContext, request } from '@playwright/test';
import { getEnvConfig } from '../config/qa.env';

/**
 * API Helper for BSS Account Payable
 * Provides methods for API-based setup/teardown and data seeding
 */
export class ApiHelper {
  private apiContext!: APIRequestContext;
  private baseURL: string;
  private authToken: string = '';

  constructor() {
    const config = getEnvConfig();
    this.baseURL = config.apiBaseURL;
  }

  /**
   * Initialize the API request context
   */
  async init(): Promise<void> {
    this.apiContext = await request.newContext({
      baseURL: this.baseURL,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ignoreHTTPSErrors: true,
    });
  }

  /**
   * Authenticate and store the auth token
   */
  async authenticate(username: string, password: string, subscriberId: string): Promise<string> {
    const response = await this.apiContext.post('/api/auth/login', {
      data: { username, password, subscriberId },
    });

    if (!response.ok()) {
      throw new Error(`Authentication failed: ${response.status()} ${response.statusText()}`);
    }

    const body = await response.json();
    this.authToken = body.token || body.access_token || '';
    return this.authToken;
  }

  /**
   * Make an authenticated GET request
   */
  async get<T = unknown>(endpoint: string): Promise<T> {
    const response = await this.apiContext.get(endpoint, {
      headers: { Authorization: `Bearer ${this.authToken}` },
    });

    if (!response.ok()) {
      throw new Error(`GET ${endpoint} failed: ${response.status()}`);
    }

    return (await response.json()) as T;
  }

  /**
   * Make an authenticated POST request
   */
  async post<T = unknown>(endpoint: string, data: Record<string, unknown>): Promise<T> {
    const response = await this.apiContext.post(endpoint, {
      headers: { Authorization: `Bearer ${this.authToken}` },
      data,
    });

    if (!response.ok()) {
      throw new Error(`POST ${endpoint} failed: ${response.status()}`);
    }

    return (await response.json()) as T;
  }

  /**
   * Make an authenticated DELETE request
   */
  async delete(endpoint: string): Promise<void> {
    const response = await this.apiContext.delete(endpoint, {
      headers: { Authorization: `Bearer ${this.authToken}` },
    });

    if (!response.ok()) {
      throw new Error(`DELETE ${endpoint} failed: ${response.status()}`);
    }
  }

  /**
   * Dispose of the API context
   */
  async dispose(): Promise<void> {
    if (this.apiContext) {
      await this.apiContext.dispose();
    }
  }
}
