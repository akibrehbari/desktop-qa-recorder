"""Unit tests for the pure event-capture logic in engine.recorder.

These tests deliberately avoid starting real pynput listeners (which require
a display/input backend that isn't available on headless CI runners).
Instead they drive the Recorder's internal callback methods directly, the
same way pynput would invoke them.
"""

import time

import pytest

pynput = pytest.importorskip("pynput")

from engine.recorder import Recorder, _key_name  # noqa: E402


class _FakeKey:
    def __init__(self, char=None, name=None):
        self.char = char
        self._name = name

    def __str__(self):
        return f"Key.{self._name}" if self._name else repr(self.char)


def make_recorder(**kwargs) -> Recorder:
    rec = Recorder(name="test", **kwargs)
    rec._start_time = time.perf_counter()
    return rec


def test_key_name_prefers_char():
    assert _key_name(_FakeKey(char="a")) == "a"


def test_key_name_falls_back_to_special_key_name():
    assert _key_name(_FakeKey(char=None, name="esc")) == "esc"


def test_on_move_records_event_when_not_throttled():
    rec = make_recorder(move_throttle_ms=0)
    rec._on_move(100, 200)
    assert len(rec._events) == 1
    assert rec._events[0].type == "move"
    assert (rec._events[0].x, rec._events[0].y) == (100, 200)


def test_on_move_is_throttled():
    rec = make_recorder(move_throttle_ms=10_000)
    rec._on_move(1, 1)
    rec._on_move(2, 2)
    assert len(rec._events) == 1


def test_on_move_disabled_via_capture_moves_flag():
    rec = make_recorder(capture_moves=False)
    rec._on_move(1, 1)
    assert rec._events == []


def test_on_click_records_button_and_state():
    rec = make_recorder()
    rec._on_click(10, 20, pynput.mouse.Button.left, True)
    event = rec._events[0]
    assert event.type == "click"
    assert event.button == "left"
    assert event.pressed is True


def test_on_scroll_records_deltas():
    rec = make_recorder()
    rec._on_scroll(5, 5, 0, -2)
    event = rec._events[0]
    assert (event.dx, event.dy) == (0, -2)


def test_stop_key_press_stops_recording_without_recording_itself():
    rec = make_recorder(stop_key="f9")
    result = rec._on_press(_FakeKey(char=None, name="f9"))
    assert result is False
    assert rec._stopped.is_set()
    # the stop keypress itself should not be captured as a key_down event
    assert all(e.key != "f9" for e in rec._events)


def test_on_press_and_release_record_key_events():
    rec = make_recorder()
    rec._on_press(_FakeKey(char="a"))
    rec._on_release(_FakeKey(char="a"))
    types = [e.type for e in rec._events]
    assert types == ["key_down", "key_up"]


def test_stop_returns_recording_with_captured_events():
    rec = make_recorder(move_throttle_ms=0)
    rec._mouse_listener = None
    rec._keyboard_listener = None
    rec._on_move(1, 2)
    rec._on_click(1, 2, pynput.mouse.Button.left, True)
    recording = rec.stop()
    assert recording.name == "test"
    assert len(recording.events) == 2
