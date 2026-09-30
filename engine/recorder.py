"""Records OS-level mouse and keyboard input into a Recording document.

Uses `pynput` for cross-platform (Windows/macOS/Linux) global input hooks.
Timestamps are captured with `time.perf_counter()` (monotonic, sub-millisecond
resolution) and stored as millisecond deltas from the moment recording starts,
so replay speed can later be scaled independent of wall-clock time.

macOS note: the process running this needs Accessibility + Input Monitoring
permissions (System Settings > Privacy & Security) for pynput to see events.
"""

from __future__ import annotations

import threading
import time
from typing import Callable, Optional

from engine.schema import InputEvent, Recording

try:
    from pynput import keyboard, mouse
except ImportError:  # pragma: no cover - exercised only when pynput missing
    keyboard = None
    mouse = None

DEFAULT_STOP_KEY = "f9"


def _key_name(key) -> str:
    """Normalize a pynput key object to a stable string name."""
    if hasattr(key, "char") and key.char is not None:
        return key.char
    return str(key).replace("Key.", "")


class Recorder:
    """Captures global mouse/keyboard events until stopped.

    Example:
        rec = Recorder(name="login-flow", stop_key="f9")
        rec.start()
        ...
        recording = rec.stop()
        recording.save("recordings/login-flow.json")
    """

    def __init__(
        self,
        name: str = "untitled-run",
        stop_key: str = DEFAULT_STOP_KEY,
        capture_moves: bool = True,
        move_throttle_ms: float = 16.0,
        on_event: Optional[Callable[[InputEvent], None]] = None,
    ) -> None:
        if mouse is None or keyboard is None:
            raise RuntimeError(
                "pynput is not installed. Run `pip install -r requirements.txt`."
            )
        self.name = name
        self.stop_key = stop_key.lower()
        self.capture_moves = capture_moves
        self.move_throttle_ms = move_throttle_ms
        self.on_event = on_event

        self._events: list[InputEvent] = []
        self._lock = threading.Lock()
        self._start_time: Optional[float] = None
        self._last_move_t: float = -1e9
        self._mouse_listener: Optional["mouse.Listener"] = None
        self._keyboard_listener: Optional["keyboard.Listener"] = None
        self._stopped = threading.Event()

    def _elapsed_ms(self) -> float:
        assert self._start_time is not None
        return (time.perf_counter() - self._start_time) * 1000.0

    def _record(self, event: InputEvent) -> None:
        with self._lock:
            self._events.append(event)
        if self.on_event:
            self.on_event(event)

    def _on_move(self, x: int, y: int) -> None:
        if not self.capture_moves:
            return
        t = self._elapsed_ms()
        if t - self._last_move_t < self.move_throttle_ms:
            return
        self._last_move_t = t
        self._record(InputEvent(type="move", t=t, x=x, y=y))

    def _on_click(self, x: int, y: int, button, pressed: bool) -> None:
        t = self._elapsed_ms()
        self._record(
            InputEvent(
                type="click",
                t=t,
                x=x,
                y=y,
                button=str(button).replace("Button.", ""),
                pressed=pressed,
            )
        )

    def _on_scroll(self, x: int, y: int, dx: int, dy: int) -> None:
        t = self._elapsed_ms()
        self._record(InputEvent(type="scroll", t=t, x=x, y=y, dx=dx, dy=dy))

    def _on_press(self, key) -> Optional[bool]:
        name = _key_name(key)
        if name.lower() == self.stop_key:
            self.request_stop()
            return False
        t = self._elapsed_ms()
        self._record(InputEvent(type="key_down", t=t, key=name))
        return None

    def _on_release(self, key) -> Optional[bool]:
        name = _key_name(key)
        if name.lower() == self.stop_key:
            return None
        t = self._elapsed_ms()
        self._record(InputEvent(type="key_up", t=t, key=name))
        return None

    def start(self) -> None:
        self._start_time = time.perf_counter()
        self._stopped.clear()
        self._mouse_listener = mouse.Listener(
            on_move=self._on_move, on_click=self._on_click, on_scroll=self._on_scroll
        )
        self._keyboard_listener = keyboard.Listener(
            on_press=self._on_press, on_release=self._on_release
        )
        self._mouse_listener.start()
        self._keyboard_listener.start()

    def request_stop(self) -> None:
        """Signal that recording should end (from the stop hotkey or an
        external controller, e.g. a SIGTERM handler). Does not itself tear
        down listeners or finalize the Recording -- call stop() for that."""
        self._stopped.set()

    def wait(self, poll_interval: float = 0.2) -> None:
        """Block until request_stop() has been called.

        Polls in short slices (rather than a single indefinite Event.wait())
        so that a signal handler calling request_stop() from the same
        process is guaranteed to be noticed promptly.
        """
        while not self._stopped.wait(poll_interval):
            pass

    def stop(self) -> Recording:
        if self._mouse_listener is not None:
            self._mouse_listener.stop()
        if self._keyboard_listener is not None:
            self._keyboard_listener.stop()
        self._stopped.set()
        with self._lock:
            events = list(self._events)
        return Recording(name=self.name, events=events)
