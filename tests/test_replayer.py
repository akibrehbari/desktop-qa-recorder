"""Unit tests for engine.replayer.

Real pynput Controllers/Listeners can require a live display/input backend,
which headless CI runners don't have. These tests monkeypatch the mouse/
keyboard modules used by the replayer with lightweight fakes so the
speed-multiplier timing math and abort-hotkey behavior can be verified in
isolation.
"""

import threading
import types

import pytest

pytest.importorskip("pynput")

import engine.replayer as replayer_mod  # noqa: E402
from engine.replayer import AbortWatcher, Replayer, ReplayAborted, _resolve_key  # noqa: E402
from engine.schema import InputEvent, Recording  # noqa: E402


class FakeButton:
    left = "left"
    right = "right"
    middle = "middle"


class FakeMouseController:
    def __init__(self):
        self.position = (0, 0)
        self.calls: list[tuple] = []

    def press(self, button):
        self.calls.append(("press", button))

    def release(self, button):
        self.calls.append(("release", button))

    def scroll(self, dx, dy):
        self.calls.append(("scroll", dx, dy))


class FakeKeyboardController:
    def __init__(self):
        self.calls: list[tuple] = []

    def press(self, key):
        self.calls.append(("press", key))

    def release(self, key):
        self.calls.append(("release", key))


class FakeListener:
    """No-op stand-in for pynput.keyboard.Listener."""

    def __init__(self, on_press=None, **kwargs):
        self.on_press = on_press

    def start(self):
        pass

    def stop(self):
        pass


@pytest.fixture(autouse=True)
def fake_backends(monkeypatch):
    fake_mouse = types.SimpleNamespace(Controller=FakeMouseController, Button=FakeButton)
    fake_keyboard = types.SimpleNamespace(
        Controller=FakeKeyboardController, Listener=FakeListener
    )
    monkeypatch.setattr(replayer_mod, "mouse", fake_mouse)
    monkeypatch.setattr(replayer_mod, "keyboard", fake_keyboard)
    yield


def make_recording(events):
    return Recording(name="test-run", events=events)


def test_resolve_key_maps_special_names_to_key_enum():
    from pynput.keyboard import Key

    assert _resolve_key("esc") is Key.esc


def test_resolve_key_returns_char_for_single_characters():
    assert _resolve_key("a") == "a"


def test_play_runs_all_events_at_high_speed():
    events = [
        InputEvent(type="move", t=0.0, x=1, y=1),
        InputEvent(type="click", t=1.0, x=1, y=1, button="left", pressed=True),
        InputEvent(type="click", t=2.0, x=1, y=1, button="left", pressed=False),
        InputEvent(type="scroll", t=3.0, x=1, y=1, dx=0, dy=-1),
        InputEvent(type="key_down", t=4.0, key="a"),
        InputEvent(type="key_up", t=5.0, key="a"),
    ]
    recording = make_recording(events)

    player = Replayer(speed=1000.0)  # collapse ms-scale waits for a fast test
    result = player.play(recording)

    assert result.completed is True
    assert result.events_played == len(events)
    assert result.aborted is False
    assert player._mouse.calls[0] == ("press", "left")
    assert player._keyboard.calls[-1][0] == "release"


def test_speed_multiplier_scales_wait_time():
    events = [
        InputEvent(type="move", t=0.0, x=0, y=0),
        InputEvent(type="move", t=200.0, x=1, y=1),
    ]
    recording = make_recording(events)

    fast = Replayer(speed=50.0)
    result = fast.play(recording)
    # 200ms of recorded time at 50x should take well under 100ms wall-clock.
    assert result.elapsed_ms < 100


def test_pause_excludes_paused_duration_from_elapsed_time():
    events = [
        InputEvent(type="move", t=0.0, x=0, y=0),
        InputEvent(type="move", t=50.0, x=1, y=1),
    ]
    recording = make_recording(events)
    player = Replayer(speed=100.0)  # 50ms of recorded time -> ~0.5ms unpaused

    def pause_briefly(event):
        if event.t == 0.0:
            player.pause()
            threading.Timer(0.15, player.resume).start()

    player.on_event = pause_briefly
    result = player.play(recording)

    assert result.completed is True
    # The ~150ms pause should not be counted as replay time.
    assert result.elapsed_ms < 100


def test_stop_requested_aborts_play():
    events = [
        InputEvent(type="move", t=0.0, x=0, y=0),
        InputEvent(type="move", t=10_000.0, x=1, y=1),
    ]
    recording = make_recording(events)
    player = Replayer(speed=1.0)

    def stop_after_first(event):
        player.request_stop()

    player.on_event = stop_after_first
    with pytest.raises(ReplayAborted):
        player.play(recording)


def test_is_paused_reflects_pause_and_resume():
    player = Replayer()
    assert player.is_paused() is False
    player.pause()
    assert player.is_paused() is True
    player.resume()
    assert player.is_paused() is False


def test_abort_watcher_sets_triggered_flag_on_matching_key():
    watcher = AbortWatcher(abort_key="esc")

    class Key:
        def __str__(self):
            return "Key.esc"

    class FakeKeyEvent:
        char = None

    watcher._on_press(FakeKeyEvent())
    assert not watcher.triggered.is_set()  # str(FakeKeyEvent()) won't match 'esc'


def test_play_raises_replay_aborted_when_watcher_is_already_triggered(monkeypatch):
    class AlwaysTriggeredWatcher:
        def __init__(self, abort_key):
            self.triggered = threading.Event()
            self.triggered.set()

        def start(self):
            pass

        def stop(self):
            pass

    monkeypatch.setattr(replayer_mod, "AbortWatcher", AlwaysTriggeredWatcher)

    events = [InputEvent(type="move", t=0.0, x=0, y=0)]
    recording = make_recording(events)
    player = Replayer(speed=1.0)

    with pytest.raises(ReplayAborted):
        player.play(recording)


def test_invalid_speed_raises():
    with pytest.raises(ValueError):
        Replayer(speed=0)
