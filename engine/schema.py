"""Data model and (de)serialization for recorded test runs.

A recording is a JSON document shaped like:

{
  "version": "1.0",
  "name": "login-flow",
  "created_at": "2026-09-29T12:00:00.000000+00:00",
  "platform": "darwin",
  "duration_ms": 4821.7,
  "events": [
    {"type": "move",     "t": 0.0,    "x": 512, "y": 340},
    {"type": "click",    "t": 512.3,  "x": 512, "y": 340, "button": "left", "pressed": true},
    {"type": "click",    "t": 588.9,  "x": 512, "y": 340, "button": "left", "pressed": false},
    {"type": "scroll",   "t": 900.1,  "x": 400, "y": 200, "dx": 0, "dy": -2},
    {"type": "key_down", "t": 1500.0, "key": "a"},
    {"type": "key_up",   "t": 1580.0, "key": "a"}
  ]
}

`t` is a millisecond offset from the start of the recording, captured with a
monotonic high-precision clock (time.perf_counter()) so replay speed can be
scaled without drifting relative to wall-clock timestamps.
"""

from __future__ import annotations

import json
import platform
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal

SCHEMA_VERSION = "1.0"

EventType = Literal["move", "click", "scroll", "key_down", "key_up"]

REQUIRED_FIELDS_BY_TYPE: dict[str, tuple[str, ...]] = {
    "move": ("x", "y"),
    "click": ("x", "y", "button", "pressed"),
    "scroll": ("x", "y", "dx", "dy"),
    "key_down": ("key",),
    "key_up": ("key",),
}


class SchemaError(ValueError):
    """Raised when a recording document does not match the expected schema."""


@dataclass
class InputEvent:
    type: EventType
    t: float
    x: int | None = None
    y: int | None = None
    button: str | None = None
    pressed: bool | None = None
    dx: int | None = None
    dy: int | None = None
    key: str | None = None

    def to_dict(self) -> dict[str, Any]:
        raw = asdict(self)
        return {k: v for k, v in raw.items() if v is not None}


@dataclass
class Recording:
    name: str
    events: list[InputEvent] = field(default_factory=list)
    version: str = SCHEMA_VERSION
    platform: str = field(default_factory=platform.system)
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    @property
    def duration_ms(self) -> float:
        if not self.events:
            return 0.0
        return max(e.t for e in self.events)

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "name": self.name,
            "created_at": self.created_at,
            "platform": self.platform,
            "duration_ms": self.duration_ms,
            "events": [e.to_dict() for e in self.events],
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)

    def save(self, path: str) -> None:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(self.to_json())

    @staticmethod
    def from_dict(data: dict[str, Any]) -> "Recording":
        validate_recording(data)
        events = [InputEvent(**e) for e in data["events"]]
        return Recording(
            name=data["name"],
            events=events,
            version=data.get("version", SCHEMA_VERSION),
            platform=data.get("platform", platform.system()),
            created_at=data.get(
                "created_at", datetime.now(timezone.utc).isoformat()
            ),
        )

    @staticmethod
    def from_json(text: str) -> "Recording":
        return Recording.from_dict(json.loads(text))

    @staticmethod
    def load(path: str) -> "Recording":
        with open(path, "r", encoding="utf-8") as fh:
            return Recording.from_json(fh.read())


def validate_recording(data: dict[str, Any]) -> None:
    """Raise SchemaError if `data` is not a well-formed recording document."""
    if not isinstance(data, dict):
        raise SchemaError("recording must be a JSON object")

    for field_name in ("name", "events"):
        if field_name not in data:
            raise SchemaError(f"recording is missing required field '{field_name}'")

    if not isinstance(data["events"], list):
        raise SchemaError("'events' must be a list")

    for i, event in enumerate(data["events"]):
        if not isinstance(event, dict):
            raise SchemaError(f"event[{i}] must be an object")
        event_type = event.get("type")
        if event_type not in REQUIRED_FIELDS_BY_TYPE:
            raise SchemaError(
                f"event[{i}] has unknown or missing type: {event_type!r}"
            )
        if "t" not in event or not isinstance(event["t"], (int, float)):
            raise SchemaError(f"event[{i}] is missing numeric 't' (timestamp ms)")
        for required in REQUIRED_FIELDS_BY_TYPE[event_type]:
            if required not in event:
                raise SchemaError(
                    f"event[{i}] of type '{event_type}' is missing '{required}'"
                )
