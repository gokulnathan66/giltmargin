export interface HttpResponse {
  status: number;
  json: unknown;
}

export type Http = (req: {
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
  body?: string;
}) => Promise<HttpResponse>;

export type RunStatus = "CREATING" | "RUNNING" | "FINISHED" | "ERROR" | "CANCELLED" | "EXPIRED";

export interface RunState {
  id: string;
  agentId: string;
  status: RunStatus;
  result?: string;
}

export const TERMINAL: ReadonlySet<string> = new Set(["FINISHED", "ERROR", "CANCELLED", "EXPIRED"]);

const API = "https://api.cursor.com/v1";

export function basicAuth(apiKey: string): string {
  return `Basic ${btoa(`${apiKey}:`)}`;
}

export function apiError(body: unknown, status: number): Error {
  if (body && typeof body === "object") {
    const err = (body as { error?: unknown; message?: unknown }).error;
    if (typeof err === "string") return new Error(err);
    if (err && typeof err === "object") {
      const message = (err as { message?: unknown }).message;
      if (typeof message === "string") return new Error(message);
    }
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string") return new Error(message);
  }
  if (status === 401) return new Error("Cursor rejected the API key.");
  if (status === 409) return new Error("Cursor is still answering the previous question.");
  return new Error(`Cursor returned HTTP ${status}`);
}

function toRun(value: unknown): RunState {
  const run = value as Partial<RunState> | null;
  if (!run || typeof run.id !== "string" || typeof run.agentId !== "string") {
    throw new Error("Cursor returned an unexpected run.");
  }
  return {
    id: run.id,
    agentId: run.agentId,
    status: run.status ?? "CREATING",
    result: typeof run.result === "string" ? run.result : undefined,
  };
}

export class CursorAgents {
  private readonly http: Http;
  private readonly apiKey: string;

  constructor(http: Http, apiKey: string) {
    this.http = http;
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    return { authorization: basicAuth(this.apiKey), "content-type": "application/json" };
  }

  private async call(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    const res = await this.http({
      method,
      url: `${API}${path}`,
      headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status < 200 || res.status >= 300) throw apiError(res.json, res.status);
    return res.json;
  }

  async createAgent(args: {
    prompt: string;
    model: string;
  }): Promise<RunState> {
    const body: Record<string, unknown> = {
      prompt: { text: args.prompt },
      name: "Giltmargin vault chat",
      mode: "agent",
    };
    if (args.model) body.model = { id: args.model };
    const json = (await this.call("POST", "/agents", body)) as { run?: unknown };
    return toRun(json.run);
  }

  async followUp(agentId: string, prompt: string): Promise<RunState> {
    const json = (await this.call("POST", `/agents/${encodeURIComponent(agentId)}/runs`, {
      prompt: { text: prompt },
    })) as { run?: unknown };
    return toRun(json.run);
  }

  async getRun(agentId: string, runId: string): Promise<RunState> {
    const json = await this.call(
      "GET",
      `/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}`,
    );
    return toRun(json);
  }

  async cancel(agentId: string, runId: string): Promise<void> {
    await this.call(
      "POST",
      `/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}/cancel`,
    );
  }
}

export async function waitForRun(
  agents: CursorAgents,
  run: RunState,
  opts: {
    intervalMs?: number;
    timeoutMs?: number;
    sleep?: (ms: number) => Promise<void>;
    isCancelled?: () => boolean;
    onStatus?: (status: RunStatus) => void;
  } = {},
): Promise<RunState> {
  const interval = opts.intervalMs ?? 3000;
  const deadline = Date.now() + (opts.timeoutMs ?? 10 * 60 * 1000);
  const sleep =
    opts.sleep ??
    ((ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms)));
  let current = run;
  while (!TERMINAL.has(current.status)) {
    if (opts.isCancelled?.()) return current;
    if (Date.now() > deadline) throw new Error("Cursor took longer than 10 minutes. Try again.");
    await sleep(interval);
    current = await agents.getRun(current.agentId, current.id);
    opts.onStatus?.(current.status);
  }
  return current;
}

export function buildPrompt(args: {
  question: string;
  notePath?: string;
  noteBody?: string;
  relatedNotes: Array<{ path: string; content: string }>;
  firstTurn: boolean;
}): string {
  const parts: string[] = [];
  if (args.firstTurn) {
    parts.push(
      "You answer questions about an Obsidian vault using read-only context supplied by the Obsidian plugin on the user's device. You have no direct access to the vault. Base the answer only on supplied notes and general knowledge, clearly distinguish the two, and cite supplied note paths as [[wikilinks]]. Reply in markdown.",
    );
  }
  if (args.notePath && args.noteBody !== undefined) {
    parts.push(
      `Open note:\n\n<note path="${args.notePath}">\n${args.noteBody}\n</note>`,
    );
  }
  if (args.relatedNotes.length > 0) {
    parts.push(
      `Related notes selected locally on the device:\n\n${args.relatedNotes
        .map((note) => `<note path="${note.path}">\n${note.content}\n</note>`)
        .join("\n\n")}`,
    );
  }
  parts.push(`Question: ${args.question}`);
  return parts.join("\n\n");
}
