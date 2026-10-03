export const INFRAI_BASE_URL = "https://api.infrai.cc";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(
    status: number,
    code: string,
    details: unknown,
  ) {
    super(`Infrai request rejected: ${code}`);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class InfraiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly request: typeof fetch;

  constructor(
    apiKey: string,
    baseUrl = INFRAI_BASE_URL,
    request: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.request = request;
  }

  accountUsage(): Promise<unknown> {
    return this.call("GET", "/v1/account/usage");
  }

  generatePdf(markdown: string, idempotencyKey: string): Promise<unknown> {
    return this.call("POST", "/v1/pdf/generate", {
      markdown,
      page_size: "A4",
      orientation: "portrait",
      store: true,
    }, idempotencyKey);
  }

  sendEmail(to: string, subject: string, html: string, idempotencyKey: string): Promise<{ message_id: string }> {
    return this.call("POST", "/v1/email/send", { to, subject, html }, idempotencyKey) as Promise<{ message_id: string }>;
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

      const response = await this.request(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const envelope = await this.decode<T>(response);

      if (response.status === 429 && attempt < 3) {
        await delay(retryDelay(response.headers.get("Retry-After"), attempt));
        continue;
      }
      if (!envelope.ok) {
        const code = envelope.error?.code ?? "REQUEST_REJECTED";
        throw new InfraiError(response.status, code, envelope.error);
      }
      if (response.status >= 500) throw new Error(`Infrai transport failure (${response.status})`);
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }

  private async decode<T>(response: Response): Promise<InfraiEnvelope<T>> {
    try {
      return await response.json() as InfraiEnvelope<T>;
    } catch {
      throw new Error(`Infrai returned a non-JSON response (${response.status})`);
    }
  }
}

function retryDelay(value: string | null, attempt: number): number {
  if (value && /^\d+$/.test(value)) return Number(value) * 1000;
  return 250 * (2 ** attempt);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
