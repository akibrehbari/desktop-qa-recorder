import { spawn } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";

import type { RecordingDetail, RecordingSummary, RunRecord } from "./types";

const REPO_ROOT = path.join(process.cwd(), "..");
const RECORDINGS_DIR = path.join(REPO_ROOT, "recordings");
const RUNS_DIR = path.join(RECORDINGS_DIR, "runs");

function pythonBin(): string {
  const venvPython = path.join(REPO_ROOT, ".venv", "bin", "python");
  if (existsSync(venvPython)) return venvPython;
  return process.platform === "win32" ? "python" : "python3";
}

async function ensureDirs(): Promise<void> {
  await fs.mkdir(RECORDINGS_DIR, { recursive: true });
  await fs.mkdir(RUNS_DIR, { recursive: true });
}

export async function listRecordings(): Promise<RecordingSummary[]> {
  await ensureDirs();
  const entries = await fs.readdir(RECORDINGS_DIR, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && e.name.endsWith(".json"));

  const summaries = await Promise.all(
    files.map(async (entry) => {
      try {
        const raw = await fs.readFile(path.join(RECORDINGS_DIR, entry.name), "utf-8");
        const data = JSON.parse(raw);
        return {
          file: entry.name,
          name: data.name ?? entry.name,
          version: data.version ?? "unknown",
          platform: data.platform ?? "unknown",
          created_at: data.created_at ?? "",
          duration_ms: data.duration_ms ?? 0,
          events_count: Array.isArray(data.events) ? data.events.length : 0,
        } satisfies RecordingSummary;
      } catch {
        return null;
      }
    })
  );

  return summaries.filter((s): s is RecordingSummary => s !== null);
}

export async function getRecording(file: string): Promise<RecordingDetail | null> {
  const safeName = path.basename(file);
  const fullPath = path.join(RECORDINGS_DIR, safeName);
  try {
    const raw = await fs.readFile(fullPath, "utf-8");
    const data = JSON.parse(raw);
    return {
      file: safeName,
      name: data.name ?? safeName,
      version: data.version ?? "unknown",
      platform: data.platform ?? "unknown",
      created_at: data.created_at ?? "",
      duration_ms: data.duration_ms ?? 0,
      events_count: Array.isArray(data.events) ? data.events.length : 0,
      events: data.events ?? [],
    };
  } catch {
    return null;
  }
}

export async function saveRecording(name: string, jsonText: string): Promise<string> {
  await ensureDirs();
  const parsed = JSON.parse(jsonText); // throws if invalid JSON
  if (!parsed.name || !Array.isArray(parsed.events)) {
    throw new Error("Recording must include a 'name' and an 'events' array");
  }
  const safeName = name.replace(/[^a-zA-Z0-9-_]/g, "_");
  const fileName = safeName.endsWith(".json") ? safeName : `${safeName}.json`;
  await fs.writeFile(path.join(RECORDINGS_DIR, fileName), JSON.stringify(parsed, null, 2));
  return fileName;
}

export async function listRuns(): Promise<RunRecord[]> {
  await ensureDirs();
  const entries = await fs.readdir(RUNS_DIR, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && e.name.endsWith(".json"));

  const runs = await Promise.all(
    files.map(async (entry) => {
      try {
        const raw = await fs.readFile(path.join(RUNS_DIR, entry.name), "utf-8");
        return JSON.parse(raw) as RunRecord;
      } catch {
        return null;
      }
    })
  );

  return runs
    .filter((r): r is RunRecord => r !== null)
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
}

export async function getRun(id: string): Promise<RunRecord | null> {
  const safeId = path.basename(id);
  try {
    const raw = await fs.readFile(path.join(RUNS_DIR, `${safeId}.json`), "utf-8");
    return JSON.parse(raw) as RunRecord;
  } catch {
    return null;
  }
}

export async function triggerReplay(
  recordingFile: string,
  speed: number
): Promise<RunRecord> {
  await ensureDirs();
  const safeFile = path.basename(recordingFile);
  const recordingPath = path.join(RECORDINGS_DIR, safeFile);
  if (!existsSync(recordingPath)) {
    throw new Error(`Recording not found: ${safeFile}`);
  }

  const runId = randomUUID();
  const runOutput = path.join(RUNS_DIR, `${runId}.json`);
  const startedAt = new Date().toISOString();

  const pending: RunRecord = {
    id: runId,
    recording_name: safeFile,
    source_file: recordingPath,
    status: "running",
    speed,
    started_at: startedAt,
    finished_at: null,
    duration_ms: 0,
    events_total: 0,
    events_played: 0,
    error: null,
  };
  await fs.writeFile(runOutput, JSON.stringify(pending, null, 2));

  const child = spawn(
    pythonBin(),
    [
      "-m",
      "engine.cli",
      "replay",
      recordingPath,
      "--speed",
      String(speed),
      "--run-id",
      runId,
      "--run-output",
      runOutput,
    ],
    {
      cwd: REPO_ROOT,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, PYTHONPATH: REPO_ROOT },
    }
  );
  child.unref();

  return pending;
}
