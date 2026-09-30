# Desktop QA Recorder

A cross-platform desktop automation and QA testing suite that records real
OS-level user workflows (mouse moves, clicks, scrolls, key presses) and
replays them deterministically — useful for regression-testing desktop UIs.

- **`engine/`** — Python core: records/replays input via [`pynput`](https://pynput.readthedocs.io/), serializes to a JSON schema, supports replay speed multipliers and an emergency abort hotkey.
- **`dashboard/`** — Next.js + React + Tailwind dashboard for browsing recordings, viewing run timelines, and triggering replays via API routes.
- **`.github/workflows/ci.yml`** — CI: runs the Python test suite and the dashboard lint/typecheck/build.

## How it works

1. **Record** a workflow with the CLI. Global mouse/keyboard listeners capture
   every event with a millisecond timestamp offset from the start of the
   recording (using a monotonic clock, so timing is stable regardless of
   wall-clock drift).
2. Events are serialized to a JSON file (see [`engine/schema.py`](engine/schema.py) for the format).
3. **Replay** the JSON file at any speed multiplier. The replayer re-derives
   each event's wait time from `t / speed` and drives the OS mouse/keyboard
   accordingly. A background listener watches for an abort hotkey
   (default `Esc`) and immediately halts playback if pressed.
4. The dashboard reads/writes the same `recordings/` directory the CLI uses,
   so recordings and run history are shared between the CLI and the web UI.

```
recordings/
├── sample-login-flow.json     # a recording (event sequence)
└── runs/
    └── <run-id>.json          # a replay's status/result record
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- **macOS**: grant the terminal/IDE running this tool Accessibility and Input
  Monitoring permissions (System Settings → Privacy & Security), or `pynput`
  won't see global input events.
- **Linux**: an X11 session (Wayland has limited global-hook support with `pynput`).

## Setup

```bash
# Python engine
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Dashboard
cd dashboard
npm install
```

## Recording a workflow

```bash
source .venv/bin/activate
python -m engine.cli record recordings/my-flow.json --name my-flow --stop-key f9
```

Perform the actions you want to capture, then press **F9** to stop. The
recording is saved to `recordings/my-flow.json`.

Options:
- `--stop-key <key>` — hotkey that ends recording (default `f9`)
- `--no-moves` — skip capturing mouse-move events (keeps click/scroll/key events)
- `--move-throttle-ms <n>` — minimum time between captured mouse-move samples (default `16`)

## Replaying a workflow

```bash
python -m engine.cli replay recordings/my-flow.json --speed 1.5 --abort-key esc
```

- `--speed <multiplier>` — playback speed (`0.5` = half speed, `2` = double speed, etc.)
- `--abort-key <key>` — emergency hotkey that immediately halts playback (default `esc`)
- `--run-output <path>` — write a run-status JSON record to this path (used by the dashboard)

The command exits `0` on a fully-completed replay and non-zero on failure or
abort, so it can be used directly as a CI/test-runner step.

## Validating a recording

```bash
python -m engine.cli validate recordings/my-flow.json
```

## Running the dashboard

```bash
cd dashboard
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Everything below works
by clicking — no terminal required:

- **Record**: click **Start Recording**, do the workflow, click **Stop
  Recording**. Runs `engine/cli.py record` as a background process; Stop
  sends it a graceful shutdown signal and the new recording appears in the
  list automatically.
- **Delete** a recording with the ✕ button on its card.
- **Upload** a recording JSON file exported from elsewhere.
- **Run** a recording at a chosen speed multiplier — spawns
  `engine/cli.py replay` as a subprocess and tracks its run record.
- **Pause / Resume / Stop** any in-progress run directly from its row in
  Test Runs. Pause freezes the recording's timeline (the paused duration is
  excluded from timing, so resuming continues exactly where it left off
  rather than firing every overdue event at once) — handy for taking over
  manually partway through a run and handing control back to the replay
  afterward. Pause/Resume use POSIX signals (`SIGUSR1`/`SIGUSR2`) and are
  not available on Windows; Stop (`SIGTERM`) works everywhere.
- Expand any run row to see its full event timeline.

### Dashboard API routes

| Route                        | Method | Purpose                                         |
| ----------------------------- | ------ | ------------------------------------------------ |
| `/api/recordings`             | GET    | List available recordings                        |
| `/api/recordings/:file`       | DELETE | Delete a recording                                |
| `/api/upload`                 | POST   | Save an uploaded recording JSON                   |
| `/api/record/start`           | POST   | Start recording (`{ name }`)                      |
| `/api/record/stop`            | POST   | Stop the in-progress recording                    |
| `/api/record/status`          | GET    | Current recording state, if any                   |
| `/api/trigger`                | POST   | Start a replay run (`{ recordingFile, speed }`)   |
| `/api/runs`                   | GET    | List run history                                  |
| `/api/runs/:id`               | GET    | Get one run's status + its recording's events     |
| `/api/runs/:id/control`       | POST   | Pause/resume/stop a run (`{ action }`)            |

## Running tests

```bash
source .venv/bin/activate
PYTHONPATH=. pytest tests/ -v
```

Tests exercise the schema (de)serialization/validation and the pure
event-capture/replay logic without requiring a live display or OS input
backend, so they run cleanly in headless CI.

## CI

[`​.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push/PR to `main`:

- **engine-tests**: installs `requirements.txt` and runs `pytest` on Python 3.10–3.12
- **dashboard**: installs npm deps, then runs `next lint`, `tsc --noEmit`, and `next build`

## Notes & safety

- The replay engine drives your **real** OS mouse/keyboard. Always keep the
  abort hotkey within reach, and don't replay a recording against an
  unfamiliar or unattended screen — a click/keystroke can land wherever
  focus happens to be at that moment.
- Recorded JSON files may contain literal keystrokes (including anything you
  typed while recording, such as passwords) — review recordings before
  committing or sharing them.
