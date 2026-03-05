export type { Paths } from "./generated/types.js";

export type ApiClientOptions = {
  baseUrl: string;
  accessToken?: string;
};

export class GazelleApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      headers: this.options.accessToken
        ? { Authorization: `Bearer ${this.options.accessToken}` }
        : undefined
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }
}
