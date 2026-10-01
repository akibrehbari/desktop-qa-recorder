import { spawn } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";

import type {
  RecordingDetail,
  RecordingState,
  RecordingSummary,
  RunRecord,
} from "./types";

const REPO_ROOT = path.join(process.cwd(), "..");
const RECORDINGS_DIR = path.join(REPO_ROOT, "recordings");
const RUNS_DIR = path.join(RECORDINGS_DIR, "runs");
const RECORDING_STATE_FILE = path.join(RECORDINGS_DIR, ".recording-state.json");

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

export async function renameRecording(
  file: string,
  newName: string
): Promise<RecordingSummary> {
  const safeFile = path.basename(file);
  const fullPath = path.join(RECORDINGS_DIR, safeFile);
  const trimmed = newName.trim();
  if (!trimmed) {
    throw new Error("Name can't be empty");
  }

  let raw: string;
  try {
    raw = await fs.readFile(fullPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Recording not found: ${safeFile}`);
    }
    throw err;
  }

  const data = JSON.parse(raw);
  data.name = trimmed;
  await fs.writeFile(fullPath, JSON.stringify(data, null, 2));

  return {
    file: safeFile,
    name: data.name,
    version: data.version ?? "unknown",
    platform: data.platform ?? "unknown",
    created_at: data.created_at ?? "",
    duration_ms: data.duration_ms ?? 0,
    events_count: Array.isArray(data.events) ? data.events.length : 0,
  };
}

export async function deleteRecording(file: string): Promise<void> {
  const safeName = path.basename(file);
  const fullPath = path.join(RECORDINGS_DIR, safeName);
  try {
    await fs.unlink(fullPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Recording not found: ${safeName}`);
    }
    throw err;
  }
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

  const pending: RunRecord = {
    id: runId,
    pid: child.pid,
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

  return pending;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export type RunControlAction = "pause" | "resume" | "stop";

export async function controlRun(
  runId: string,
  action: RunControlAction
): Promise<RunRecord> {
  const run = await getRun(runId);
  if (!run) {
    throw new Error("Run not found");
  }
  if (!run.pid) {
    throw new Error("This run has no attached process to control");
  }
  if (!isProcessAlive(run.pid)) {
    throw new Error("That run's process has already finished");
  }
  if (action !== "stop" && process.platform === "win32") {
    throw new Error("Pause/Resume isn't supported on Windows — use Stop instead");
  }

  const signal =
    action === "stop" ? "SIGTERM" : action === "pause" ? "SIGUSR1" : "SIGUSR2";
  process.kill(run.pid, signal);

  // Give the replay process a brief moment to write its updated status.
  await new Promise((resolve) => setTimeout(resolve, 300));
  const updated = await getRun(runId);
  return updated ?? run;
}

async function readRecordingState(): Promise<RecordingState | null> {
  try {
    const raw = await fs.readFile(RECORDING_STATE_FILE, "utf-8");
    return JSON.parse(raw) as RecordingState;
  } catch {
    return null;
  }
}

export async function getRecordingStatus(): Promise<RecordingState | null> {
  const state = await readRecordingState();
  if (!state) return null;
  if (!isProcessAlive(state.pid)) {
    // The recorder process died/crashed without us clearing this file.
    await fs.rm(RECORDING_STATE_FILE, { force: true });
    return null;
  }
  return state;
}

export async function startRecording(name: string): Promise<RecordingState> {
  await ensureDirs();
  const existing = await getRecordingStatus();
  if (existing) {
    throw new Error(`A recording ("${existing.name}") is already in progress`);
  }

  const safeName =
    name.replace(/[^a-zA-Z0-9-_]/g, "_").replace(/^_+|_+$/g, "") ||
    `recording-${Date.now()}`;
  const fileName = `${safeName}.json`;
  const outputPath = path.join(RECORDINGS_DIR, fileName);

  const child = spawn(
    pythonBin(),
    ["-m", "engine.cli", "record", outputPath, "--name", safeName],
    {
      cwd: REPO_ROOT,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, PYTHONPATH: REPO_ROOT },
    }
  );
  child.unref();

  if (!child.pid) {
    throw new Error("Failed to start the recorder process");
  }

  const state: RecordingState = {
    pid: child.pid,
    name: safeName,
    file: fileName,
    started_at: new Date().toISOString(),
  };
  await fs.writeFile(RECORDING_STATE_FILE, JSON.stringify(state, null, 2));
  return state;
}

export async function stopRecording(): Promise<{ file: string; name: string }> {
  const state = await readRecordingState();
  if (!state) {
    throw new Error("No recording is currently in progress");
  }

  try {
    process.kill(state.pid, "SIGTERM");
  } catch {
    // Process may have already exited on its own (e.g. the F9 stop hotkey).
  }

  // Give the recorder a brief window to flush the JSON file and exit before
  // we tell the UI it's safe to refresh the recordings list.
  for (let i = 0; i < 15 && isProcessAlive(state.pid); i++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  await fs.rm(RECORDING_STATE_FILE, { force: true });
  return { file: state.file, name: state.name };
}
