// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

export interface LogBufferOptions {
  /** Maximum number of complete lines kept. */
  maxLines?: number;
  /** Lines longer than this are truncated. */
  maxLineLength?: number;
}

/**
 * Bounded in-memory ring buffer of child output lines. Chunks are split on
 * newlines; an unfinished trailing line is held back per stream until it ends
 * (or until `tail` is asked for, which includes it).
 */
export class LogBuffer {
  private readonly maxLines: number;
  private readonly maxLineLength: number;
  private lines: string[] = [];
  private partial = new Map<string, string>();
  private totalLines = 0;

  constructor(options: LogBufferOptions = {}) {
    this.maxLines = Math.max(1, options.maxLines ?? 300);
    this.maxLineLength = Math.max(16, options.maxLineLength ?? 2000);
  }

  get capacity(): number {
    return this.maxLines;
  }

  /** Total complete lines ever pushed, including those already dropped. */
  get total(): number {
    return this.totalLines;
  }

  push(chunk: string, stream: "stdout" | "stderr" = "stdout"): void {
    const text = (this.partial.get(stream) ?? "") + chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const parts = text.split("\n");
    const rest = parts.pop() ?? "";
    for (const part of parts) this.append(stream, part);
    // Never let an unterminated line grow without bound.
    if (rest.length > this.maxLineLength) {
      this.append(stream, rest);
      this.partial.delete(stream);
    } else if (rest === "") {
      this.partial.delete(stream);
    } else {
      this.partial.set(stream, rest);
    }
  }

  /** Marks the end of output: flushes unfinished lines. */
  flush(): void {
    for (const [stream, rest] of this.partial) this.append(stream, rest);
    this.partial.clear();
  }

  /** Adds a line written by the plugin itself (not by the child). */
  note(message: string): void {
    this.append("plugin", message);
  }

  tail(count: number = this.maxLines): string[] {
    const pending = [...this.partial.entries()].map(([stream, text]) => this.format(stream, text));
    const all = [...this.lines, ...pending];
    const n = Math.max(0, Math.min(count, this.maxLines));
    return n === 0 ? [] : all.slice(-n);
  }

  clear(): void {
    this.lines = [];
    this.partial.clear();
  }

  private append(stream: string, raw: string): void {
    this.lines.push(this.format(stream, raw));
    this.totalLines += 1;
    if (this.lines.length > this.maxLines) this.lines.splice(0, this.lines.length - this.maxLines);
  }

  private format(stream: string, raw: string): string {
    const clean = raw.replace(ANSI_PATTERN, "");
    const line = clean.length > this.maxLineLength ? `${clean.slice(0, this.maxLineLength)}...` : clean;
    return stream === "stderr" ? `[err] ${line}` : stream === "plugin" ? `[plugin] ${line}` : line;
  }
}
