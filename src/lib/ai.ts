import { spawn } from "node:child_process";

export type AiTurn = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiResult =
  | { ok: true; text: string; model: string }
  | { ok: false; reason: "not_configured" | "timeout" | "provider_error"; detail?: string };

const DEFAULT_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";
const ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const ATTEMPT_TIMEOUT_MS = 12_000;

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
};

function runCurl(body: string, key: string, timeoutMs: number): Promise<AiResult> {
  return new Promise<AiResult>((resolve) => {
    const child = spawn(
      "bash",
      [
        "-c",
        `curl -sS --http2 --max-time ${Math.max(5, Math.floor(timeoutMs / 1000))} -X POST '${ENDPOINT}' -H 'Content-Type: application/json' -H 'Accept: application/json' -H "Authorization: Bearer $NVIDIA_API_KEY" --data-binary @-`,
      ],
      {
        env: { ...process.env, NVIDIA_API_KEY: key },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result: AiResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ ok: false, reason: "timeout" });
    }, timeoutMs + 2000);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      finish({
        ok: false,
        reason: "provider_error",
        detail: error.message.slice(0, 160),
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      let data: ProviderPayload = {};
      try {
        data = JSON.parse(stdout) as ProviderPayload;
      } catch {
        finish({
          ok: false,
          reason: "provider_error",
          detail: (stderr || stdout || `curl exited ${code}`).slice(0, 180),
        });
        return;
      }
      const content =
        data.choices?.[0]?.message?.content?.trim() ||
        data.choices?.[0]?.message?.reasoning_content?.trim() ||
        "";
      if (!content) {
        finish({
          ok: false,
          reason: "provider_error",
          detail: (data.detail || data.title || stderr || "Empty completion").slice(0, 180),
        });
        return;
      }
      finish({ ok: true, text: content, model: data.model || DEFAULT_MODEL });
    });

    child.stdin.write(body);
    child.stdin.end();
  });
}

/**
 * Server-only NVIDIA NIM client.
 *
 * The provider is called through the host curl binary because this OCI image's
 * Node HTTP stack times out against the NIM edge while curl's HTTP/2 path is
 * stable. The API key is passed in the child environment, never in argv, logs
 * or the browser.
 */
export async function askWasslAssistant(
  messages: AiTurn[],
  _options: { signal?: AbortSignal } = {},
): Promise<AiResult> {
  const key = process.env.NVIDIA_API_KEY?.trim();
  if (!key) return { ok: false, reason: "not_configured" };

  const body = JSON.stringify({
    model: process.env.NVIDIA_MODEL?.trim() || DEFAULT_MODEL,
    messages,
    temperature: 0.25,
    top_p: 0.9,
    max_tokens: 220,
    stream: false,
    // This model is a reasoning model; disable the long monologue so customer
    // support replies stay fast and the token budget goes to the answer.
    chat_template_kwargs: { enable_thinking: false },
  });

  const first = await runCurl(body, key, ATTEMPT_TIMEOUT_MS);
  if (first.ok) return first;
  const transportFailure =
    first.reason === "timeout" ||
    /curl:|timed out|socket|ECONN|network/i.test(first.detail ?? "");
  if (!transportFailure) return first;
  return runCurl(body, key, ATTEMPT_TIMEOUT_MS);
}
