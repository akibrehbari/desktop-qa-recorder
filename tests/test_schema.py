import json

import pytest

from engine.schema import InputEvent, Recording, SchemaError, validate_recording


def make_sample_recording() -> Recording:
    return Recording(
        name="sample",
        events=[
            InputEvent(type="move", t=0.0, x=10, y=20),
            InputEvent(type="click", t=100.0, x=10, y=20, button="left", pressed=True),
            InputEvent(type="click", t=150.0, x=10, y=20, button="left", pressed=False),
            InputEvent(type="scroll", t=200.0, x=10, y=20, dx=0, dy=-1),
            InputEvent(type="key_down", t=300.0, key="a"),
            InputEvent(type="key_up", t=340.0, key="a"),
        ],
    )


def test_round_trip_serialization():
    recording = make_sample_recording()
    text = recording.to_json()
    restored = Recording.from_json(text)

    assert restored.name == recording.name
    assert len(restored.events) == len(recording.events)
    assert restored.events[1].button == "left"
    assert restored.duration_ms == pytest.approx(340.0)


def test_save_and_load_round_trip(tmp_path):
    recording = make_sample_recording()
    path = tmp_path / "run.json"
    recording.save(str(path))

    loaded = Recording.load(str(path))
    assert loaded.to_dict() == recording.to_dict()


def test_validate_recording_accepts_well_formed_doc():
    data = make_sample_recording().to_dict()
    validate_recording(data)  # should not raise


@pytest.mark.parametrize(
    "mutate",
    [
        lambda d: d.pop("name"),
        lambda d: d.pop("events"),
        lambda d: d["events"].append({"type": "bogus", "t": 0}),
        lambda d: d["events"].append({"type": "click", "t": 0}),  # missing fields
        lambda d: d["events"].append({"type": "move", "x": 1, "y": 2}),  # missing t
    ],
)
def test_validate_recording_rejects_malformed_docs(mutate):
    data = make_sample_recording().to_dict()
    mutate(data)
    with pytest.raises(SchemaError):
        validate_recording(data)


def test_validate_recording_rejects_non_object():
    with pytest.raises(SchemaError):
        validate_recording([])  # type: ignore[arg-type]


def test_from_json_raises_on_invalid_json_shape():
    with pytest.raises(SchemaError):
        Recording.from_json(json.dumps({"name": "x"}))
