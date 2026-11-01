import https from "node:https";

export type AiTurn = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiResult =
  | { ok: true; text: string; model: string }
  | { ok: false; reason: "not_configured" | "timeout" | "provider_error"; detail?: string };

const DEFAULT_MODEL = "meta/llama-3.2-90b-vision-instruct";
const HOST = "integrate.api.nvidia.com";
const PATH = "/v1/chat/completions";
const TIMEOUT_MS = 25_000;

export function aiConfigured(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY?.trim());
}

type ProviderPayload = {
  model?: string;
  choices?: Array<{
    message?: { content?: string | null; reasoning_content?: string | null };
  }>;
  detail?: string;
  title?: string;
  status?: number;
};

/**
 * Server-only NVIDIA NIM client. Uses node:https with IPv4 so the request
 * works on hosts where Node's default DNS order resolves an unreachable
 * address. The key never reaches the browser or a chat message.
 */
export async function askWasslAssistant(
  messages: AiTurn[],
  options: { signal?: AbortSignal } = {},
): Promise<AiResult> {
  const key = process.env.NVIDIA_API_KEY?.trim();
  if (!key) return { ok: false, reason: "not_configured" };

  const body = JSON.stringify({
    model: process.env.NVIDIA_MODEL?.trim() || DEFAULT_MODEL,
    messages,
    temperature: 0.25,
    top_p: 0.9,
    max_tokens: 420,
    stream: false,
  });

  return new Promise<AiResult>((resolve) => {
    let settled = false;
    const finish = (result: AiResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const request = https.request(
      {
        hostname: HOST,
        path: PATH,
        method: "POST",
        family: 4,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let data: ProviderPayload = {};
          try {
            data = JSON.parse(raw) as ProviderPayload;
          } catch {
            // Keep the status-based error below.
          }
          if ((response.statusCode ?? 500) >= 400) {
            finish({
              ok: false,
              reason: "provider_error",
              detail: `${response.statusCode} ${data.detail || data.title || raw.slice(0, 200)}`,
            });
            return;
          }
          const content =
            data.choices?.[0]?.message?.content?.trim() ||
            data.choices?.[0]?.message?.reasoning_content?.trim() ||
            "";
          if (!content) {
            finish({ ok: false, reason: "provider_error", detail: "Empty completion" });
            return;
          }
          finish({ ok: true, text: content, model: data.model || DEFAULT_MODEL });
        });
      },
    );

    request.setTimeout(TIMEOUT_MS, () => {
      request.destroy();
      finish({ ok: false, reason: "timeout" });
    });
    request.on("error", (error) => {
      finish({
        ok: false,
        reason: "provider_error",
        detail: error.message.slice(0, 200),
      });
    });
    options.signal?.addEventListener("abort", () => {
      request.destroy();
      finish({ ok: false, reason: "timeout" });
    });
    request.write(body);
    request.end();
  });
}
