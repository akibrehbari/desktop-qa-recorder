"""Deterministically replays a Recording with a configurable speed multiplier
and a global emergency-abort hotkey.

Playback re-derives each event's absolute delay from its recorded `t`
(ms offset from the start of the recording) divided by `speed`, then sleeps
that long relative to the wall-clock start of the replay. Using absolute
offsets (rather than accumulating per-event deltas) avoids drift across a
long run.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Callable, Optional

from engine.schema import InputEvent, Recording

try:
    from pynput import keyboard, mouse
    from pynput.keyboard import Key, KeyCode
except ImportError:  # pragma: no cover
    keyboard = None
    mouse = None
    Key = None
    KeyCode = None

DEFAULT_ABORT_KEY = "esc"


class ReplayAborted(Exception):
    """Raised when the emergency-abort hotkey is triggered mid-replay."""


@dataclass
class ReplayResult:
    completed: bool
    events_played: int
    events_total: int
    elapsed_ms: float
    aborted: bool = False


def _resolve_key(name: str):
    """Map a stored key name back to a pynput Key/char for sending input."""
    name = name
    special = getattr(Key, name, None) if Key is not None else None
    if special is not None:
        return special
    if len(name) == 1:
        return name
    return name


class AbortWatcher:
    """Background listener that sets a threading.Event when the abort
    hotkey is pressed, so a running replay loop can check it and bail out."""

    def __init__(self, abort_key: str = DEFAULT_ABORT_KEY) -> None:
        self.abort_key = abort_key.lower()
        self.triggered = threading.Event()
        self._listener: Optional["keyboard.Listener"] = None

    def _on_press(self, key) -> None:
        name = getattr(key, "char", None) or str(key).replace("Key.", "")
        if name.lower() == self.abort_key:
            self.triggered.set()

    def start(self) -> None:
        if keyboard is None:
            return
        self._listener = keyboard.Listener(on_press=self._on_press)
        self._listener.start()

    def stop(self) -> None:
        if self._listener is not None:
            self._listener.stop()


class Replayer:
    """Replays a Recording via pynput Controllers.

    Example:
        recording = Recording.load("recordings/login-flow.json")
        player = Replayer(speed=1.5, abort_key="esc")
        result = player.play(recording)
    """

    def __init__(
        self,
        speed: float = 1.0,
        abort_key: str = DEFAULT_ABORT_KEY,
        on_event: Optional[Callable[[InputEvent], None]] = None,
    ) -> None:
        if speed <= 0:
            raise ValueError("speed multiplier must be > 0")
        self.speed = speed
        self.abort_key = abort_key
        self.on_event = on_event
        self._mouse: Optional["mouse.Controller"] = None
        self._keyboard: Optional["keyboard.Controller"] = None

    def _ensure_controllers(self) -> None:
        if mouse is None or keyboard is None:
            raise RuntimeError(
                "pynput is not installed. Run `pip install -r requirements.txt`."
            )
        if self._mouse is None:
            self._mouse = mouse.Controller()
        if self._keyboard is None:
            self._keyboard = keyboard.Controller()

    def _apply(self, event: InputEvent) -> None:
        assert self._mouse is not None and self._keyboard is not None
        if event.type == "move":
            self._mouse.position = (event.x, event.y)
        elif event.type == "click":
            self._mouse.position = (event.x, event.y)
            button = getattr(mouse.Button, event.button, mouse.Button.left)
            if event.pressed:
                self._mouse.press(button)
            else:
                self._mouse.release(button)
        elif event.type == "scroll":
            self._mouse.position = (event.x, event.y)
            self._mouse.scroll(event.dx, event.dy)
        elif event.type == "key_down":
            self._keyboard.press(_resolve_key(event.key))
        elif event.type == "key_up":
            self._keyboard.release(_resolve_key(event.key))

        if self.on_event:
            self.on_event(event)

    def play(self, recording: Recording) -> ReplayResult:
        self._ensure_controllers()
        watcher = AbortWatcher(self.abort_key)
        watcher.start()

        start = time.perf_counter()
        played = 0
        aborted = False
        try:
            for event in recording.events:
                if watcher.triggered.is_set():
                    aborted = True
                    break

                target_offset_s = (event.t / 1000.0) / self.speed
                now_offset_s = time.perf_counter() - start
                remaining = target_offset_s - now_offset_s
                if remaining > 0:
                    # Sleep in short slices so the abort hotkey stays responsive.
                    slice_s = 0.02
                    while remaining > 0 and not watcher.triggered.is_set():
                        time.sleep(min(slice_s, remaining))
                        remaining -= slice_s
                if watcher.triggered.is_set():
                    aborted = True
                    break

                self._apply(event)
                played += 1
        finally:
            watcher.stop()

        elapsed_ms = (time.perf_counter() - start) * 1000.0
        if aborted:
            raise ReplayAborted(
                f"Replay aborted by hotkey '{self.abort_key}' after "
                f"{played}/{len(recording.events)} events"
            )

        return ReplayResult(
            completed=played == len(recording.events),
            events_played=played,
            events_total=len(recording.events),
            elapsed_ms=elapsed_ms,
            aborted=False,
        )
