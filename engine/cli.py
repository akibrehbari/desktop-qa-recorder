"""Command-line entry point for recording and replaying macros.

Usage:
    python -m engine.cli record recordings/login-flow.json --name login-flow --stop-key f9
    python -m engine.cli replay recordings/login-flow.json --speed 1.5 --abort-key esc
    python -m engine.cli validate recordings/login-flow.json
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from engine.recorder import DEFAULT_STOP_KEY, Recorder
from engine.replayer import DEFAULT_ABORT_KEY, ReplayAborted, Replayer
from engine.schema import Recording, SchemaError, validate_recording


def _cmd_record(args: argparse.Namespace) -> int:
    name = args.name or Path(args.output).stem
    print(f"[record] recording '{name}' — press '{args.stop_key}' to stop.")
    recorder = Recorder(
        name=name,
        stop_key=args.stop_key,
        capture_moves=not args.no_moves,
        move_throttle_ms=args.move_throttle_ms,
        on_event=lambda e: print(f"  captured: {e.type} @ {e.t:.1f}ms"),
    )
    def _handle_external_stop(signum, frame):  # noqa: ARG001
        recorder.request_stop()

    signal.signal(signal.SIGTERM, _handle_external_stop)
    signal.signal(signal.SIGINT, _handle_external_stop)

    recorder.start()
    recorder.wait()
    recording = recorder.stop()
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    recording.save(args.output)
    print(
        f"[record] saved {len(recording.events)} events "
        f"({recording.duration_ms:.1f}ms) -> {args.output}"
    )
    return 0


def _cmd_replay(args: argparse.Namespace) -> int:
    recording = Recording.load(args.input)
    run_id = args.run_id or str(uuid.uuid4())
    started_at = datetime.now(timezone.utc).isoformat()

    print(
        f"[replay] '{recording.name}' — {len(recording.events)} events "
        f"at {args.speed}x speed. Press '{args.abort_key}' to abort."
    )

    progress_lock = threading.Lock()
    progress = {"played": 0}

    def _on_event(e):
        with progress_lock:
            progress["played"] += 1
        print(f"  playing: {e.type} @ {e.t:.1f}ms")

    player = Replayer(speed=args.speed, abort_key=args.abort_key, on_event=_on_event)

    # Let an external controller (e.g. the dashboard, via this process's pid)
    # pause/resume/stop playback without needing a focused terminal window.
    # SIGUSR1/SIGUSR2 aren't available on Windows, so pause/resume is a
    # POSIX-only convenience there; Stop (SIGTERM/SIGINT) still works everywhere.
    signal.signal(signal.SIGTERM, lambda signum, frame: player.request_stop())
    signal.signal(signal.SIGINT, lambda signum, frame: player.request_stop())
    if hasattr(signal, "SIGUSR1"):
        signal.signal(signal.SIGUSR1, lambda signum, frame: player.pause())
    if hasattr(signal, "SIGUSR2"):
        signal.signal(signal.SIGUSR2, lambda signum, frame: player.resume())

    def _write_status(status: str, error: str | None = None, finished: bool = False) -> dict:
        with progress_lock:
            played = progress["played"]
        record = {
            "id": run_id,
            "pid": os.getpid(),
            "recording_name": recording.name,
            "source_file": str(Path(args.input).resolve()),
            "status": status,
            "speed": args.speed,
            "started_at": started_at,
            "finished_at": datetime.now(timezone.utc).isoformat() if finished else None,
            "duration_ms": player.elapsed_ms(),
            "events_total": len(recording.events),
            "events_played": played,
            "error": error,
        }
        if args.run_output:
            Path(args.run_output).parent.mkdir(parents=True, exist_ok=True)
            tmp_path = f"{args.run_output}.tmp"
            with open(tmp_path, "w", encoding="utf-8") as fh:
                json.dump(record, fh, indent=2)
            os.replace(tmp_path, args.run_output)
        return record

    stop_reporting = threading.Event()

    def _report_pause_transitions() -> None:
        last_paused = None
        while not stop_reporting.is_set():
            paused = player.is_paused()
            if paused != last_paused:
                _write_status("paused" if paused else "running")
                last_paused = paused
            stop_reporting.wait(0.25)

    reporter = threading.Thread(target=_report_pause_transitions, daemon=True)
    reporter.start()

    status = "passed"
    error_message = None
    try:
        player.play(recording)
    except ReplayAborted as exc:
        status = "aborted"
        error_message = str(exc)
    except Exception as exc:  # noqa: BLE001 - surfaced in the run record
        status = "failed"
        error_message = str(exc)
    finally:
        stop_reporting.set()
        reporter.join(timeout=1.0)

    run_record = _write_status(status, error=error_message, finished=True)
    print(json.dumps(run_record, indent=2))
    return 0 if status == "passed" else 1


def _cmd_validate(args: argparse.Namespace) -> int:
    try:
        with open(args.input, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        validate_recording(data)
    except (SchemaError, json.JSONDecodeError, OSError) as exc:
        print(f"[validate] INVALID: {exc}", file=sys.stderr)
        return 1
    print(f"[validate] OK: {args.input} is a valid recording")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="qa-recorder", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p_record = sub.add_parser("record", help="Record OS input events to a file")
    p_record.add_argument("output", help="Path to write the recording JSON to")
    p_record.add_argument("--name", help="Human-readable name for the recording")
    p_record.add_argument(
        "--stop-key", default=DEFAULT_STOP_KEY, help="Hotkey that stops recording"
    )
    p_record.add_argument(
        "--no-moves", action="store_true", help="Skip capturing mouse-move events"
    )
    p_record.add_argument(
        "--move-throttle-ms",
        type=float,
        default=16.0,
        help="Minimum ms between captured mouse-move samples",
    )
    p_record.set_defaults(func=_cmd_record)

    p_replay = sub.add_parser("replay", help="Replay a recording")
    p_replay.add_argument("input", help="Path to the recording JSON to replay")
    p_replay.add_argument(
        "--speed", type=float, default=1.0, help="Playback speed multiplier"
    )
    p_replay.add_argument(
        "--abort-key",
        default=DEFAULT_ABORT_KEY,
        help="Emergency hotkey that immediately aborts playback",
    )
    p_replay.add_argument("--run-id", help="Explicit run id (default: random UUID)")
    p_replay.add_argument(
        "--run-output", help="Write the run status JSON to this path"
    )
    p_replay.set_defaults(func=_cmd_replay)

    p_validate = sub.add_parser("validate", help="Validate a recording file's schema")
    p_validate.add_argument("input", help="Path to the recording JSON to validate")
    p_validate.set_defaults(func=_cmd_validate)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
