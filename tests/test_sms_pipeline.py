"""Tests for the gateway-level SMS stabilization pipeline."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest

# Load the pure module without importing the integration package, which needs
# the full Home Assistant runtime and is intentionally not a test dependency.
MODULE_PATH = (
    Path(__file__).parents[1]
    / "custom_components"
    / "sms_gammu_viewer"
    / "sms_pipeline.py"
)
SPEC = importlib.util.spec_from_file_location("sms_pipeline_under_test", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)
SnapshotStabilizer = MODULE.SnapshotStabilizer
parse_gateway_messages = MODULE.parse_gateway_messages


def sms(text: str, *, date: str = "2026-08-16 12:00:00", **extra) -> dict:
    return {
        "Number": "+70000000000",
        "Text": text,
        "Date": date,
        "State": "UnRead",
        **extra,
    }


class ParseGatewayMessagesTests(unittest.TestCase):
    def test_messages_from_same_sender_stay_separate_and_ordered(self) -> None:
        parsed = parse_gateway_messages([sms("first"), sms("second")])
        self.assertEqual([item.text for item in parsed], ["first", "second"])

    def test_identical_items_are_not_collapsed(self) -> None:
        parsed = parse_gateway_messages([sms("same"), sms("same")])
        self.assertEqual(len(parsed), 2)

    def test_completeness_metadata_is_parsed(self) -> None:
        parsed = parse_gateway_messages([
            sms("long", Complete="true", PartsReceived="2", PartsExpected=2)
        ])
        self.assertTrue(parsed[0].complete)
        self.assertEqual(parsed[0].parts_received, 2)
        self.assertEqual(parsed[0].parts_expected, 2)


class SnapshotStabilizerTests(unittest.TestCase):
    def test_unknown_gateway_waits_for_repeated_identical_snapshots(self) -> None:
        tracker = SnapshotStabilizer(required_unchanged=3)
        snapshot = parse_gateway_messages([sms("complete")])
        self.assertFalse(tracker.observe(snapshot).ready)
        self.assertFalse(tracker.observe(snapshot).ready)
        self.assertTrue(tracker.observe(snapshot).ready)

    def test_growing_partial_message_resets_stability(self) -> None:
        tracker = SnapshotStabilizer(required_unchanged=2)
        self.assertFalse(tracker.observe(parse_gateway_messages([sms("part")])).ready)
        grown = parse_gateway_messages([sms("part two")])
        self.assertFalse(tracker.observe(grown).ready)
        self.assertTrue(tracker.observe(grown).ready)

    def test_explicit_incomplete_never_becomes_ready(self) -> None:
        tracker = SnapshotStabilizer(required_unchanged=2)
        snapshot = parse_gateway_messages([
            sms("part", Complete=False, PartsReceived=1, PartsExpected=2)
        ])
        for _ in range(5):
            self.assertFalse(tracker.observe(snapshot).ready)

    def test_explicit_complete_is_ready_immediately(self) -> None:
        tracker = SnapshotStabilizer(required_unchanged=5)
        snapshot = parse_gateway_messages([
            sms("whole", Complete=True, PartsReceived=2, PartsExpected=2)
        ])
        self.assertTrue(tracker.observe(snapshot).ready)

    def test_two_messages_from_same_sender_are_never_concatenated(self) -> None:
        tracker = SnapshotStabilizer(required_unchanged=2)
        snapshot = parse_gateway_messages([sms("one"), sms("two")])
        tracker.observe(snapshot)
        result = tracker.observe(snapshot)
        self.assertTrue(result.ready)
        self.assertEqual([item.text for item in result.messages], ["one", "two"])


if __name__ == "__main__":
    unittest.main()
