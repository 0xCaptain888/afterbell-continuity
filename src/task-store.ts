import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { WatchedPosition, WatchtowerEvent } from "./watchtower.js";

export type WatchTask = {
  taskId: string;
  status: "ACTIVE" | "PAUSED";
  intervalSeconds: number;
  createdAt: string;
  updatedAt: string;
  nextRunAt: string;
  position: WatchedPosition;
  lastEvent?: WatchtowerEvent;
};

type TaskJournalEntry = { operation: "UPSERT"; recordedAt: string; task: WatchTask };

export class FileWatchTaskStore {
  private loaded = false;
  private readonly tasks = new Map<string, WatchTask>();

  constructor(private readonly journalPath: string) {}

  private async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const journal = await readFile(this.journalPath, "utf8");
      for (const line of journal.split("\n")) {
        if (!line.trim()) continue;
        const entry = JSON.parse(line) as TaskJournalEntry;
        if (entry.operation === "UPSERT") this.tasks.set(entry.task.taskId, entry.task);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  async list(): Promise<WatchTask[]> {
    await this.load();
    return [...this.tasks.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async get(taskId: string): Promise<WatchTask | undefined> {
    await this.load();
    return this.tasks.get(taskId);
  }

  async upsert(task: WatchTask): Promise<void> {
    await this.load();
    this.tasks.set(task.taskId, task);
    await mkdir(dirname(this.journalPath), { recursive: true });
    const entry: TaskJournalEntry = { operation: "UPSERT", recordedAt: new Date().toISOString(), task };
    await appendFile(this.journalPath, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
  }
}
