export type RunStatus = "running" | "passed" | "failed" | "aborted";

export interface RunRecord {
  id: string;
  recording_name: string;
  source_file: string;
  status: RunStatus;
  speed: number;
  started_at: string;
  finished_at: string | null;
  duration_ms: number;
  events_total: number;
  events_played: number;
  error: string | null;
}

export interface InputEvent {
  type: "move" | "click" | "scroll" | "key_down" | "key_up";
  t: number;
  x?: number;
  y?: number;
  button?: string;
  pressed?: boolean;
  dx?: number;
  dy?: number;
  key?: string;
}

export interface RecordingSummary {
  file: string;
  name: string;
  version: string;
  platform: string;
  created_at: string;
  duration_ms: number;
  events_count: number;
}

export interface RecordingDetail extends RecordingSummary {
  events: InputEvent[];
}
