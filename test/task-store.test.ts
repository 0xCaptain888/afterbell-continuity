import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sampleMandate, sampleRights, sampleSnapshot } from "../src/sample.js";
import { FileWatchTaskStore, type WatchTask } from "../src/task-store.js";

test("watch tasks survive process-style store reconstruction", async () => {
  const path = join(tmpdir(), `afterbell-${randomUUID()}.jsonl`);
  const task: WatchTask = {
    taskId: "task-1",
    status: "ACTIVE",
    intervalSeconds: 300,
    createdAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
    nextRunAt: "2026-09-18T00:05:00.000Z",
    position: {
      positionId: "position-1",
      wallet: sampleMandate.owner,
      amount: 0.1,
      positionUsd: 20,
      snapshot: sampleSnapshot,
      rights: sampleRights,
      mandate: sampleMandate
    }
  };
  await new FileWatchTaskStore(path).upsert(task);
  assert.deepEqual(await new FileWatchTaskStore(path).get(task.taskId), task);
  assert.equal((await readFile(path, "utf8")).trim().split("\n").length, 1);
});
