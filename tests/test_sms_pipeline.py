"""Tests for the gateway-level SMS stabilization pipeline."""
from __future__ import annotations

import ast
import importlib.util
from pathlib import Path
import sys
from types import SimpleNamespace
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
parse_lean_queue = MODULE.parse_lean_queue

STORE_PATH = MODULE_PATH.with_name("store.py")
STORE_SPEC = importlib.util.spec_from_file_location("store_for_pipeline_test", STORE_PATH)
assert STORE_SPEC and STORE_SPEC.loader
STORE_MODULE = importlib.util.module_from_spec(STORE_SPEC)
STORE_SPEC.loader.exec_module(STORE_MODULE)
SmsStore = STORE_MODULE.SmsStore


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

    def test_durable_queue_preserves_ack_id_and_message(self) -> None:
        parsed = parse_lean_queue([{
            "ID": "stable-id",
            "Number": "+70000000000",
            "Text": "assembled",
            "Date": "2026-08-16T20:00:00",
        }])
        self.assertEqual(parsed[0].id, "stable-id")
        self.assertEqual(parsed[0].message.text, "assembled")

    def test_durable_queue_rejects_item_without_identity(self) -> None:
        parsed = parse_lean_queue([sms("unsafe")])
        self.assertEqual(parsed, ())


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


class NotificationSenderTests(unittest.IsolatedAsyncioTestCase):
    async def test_notification_uses_the_sender_key_saved_by_store(self) -> None:
        init_path = MODULE_PATH.with_name("__init__.py")
        tree = ast.parse(init_path.read_text(encoding="utf-8"))
        coordinator = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "SmsCoordinator")
        save = next(node for node in coordinator.body if isinstance(node, ast.AsyncFunctionDef) and node.name == "_save_logical_sms")
        scope = {
            "LogicalSms": MODULE.LogicalSms,
            "_looks_like_wap_push": lambda _: False,
            "EVENT_SMS_RECEIVED": "sms_received",
        }
        exec(compile(ast.Module(body=[save], type_ignores=[]), str(init_path), "exec"), scope)

        saved, notified, events = [], [], []
        store = SimpleNamespace(
            _sanitize_number=SmsStore._sanitize_number,
            add=lambda number, text, date: saved.append(number) or 1,
        )

        async def run_job(func, *args):
            return func(*args)

        async def notify(number, text):
            notified.append(number)

        context = SimpleNamespace(
            store=store,
            hass=SimpleNamespace(
                async_add_executor_job=run_job,
                bus=SimpleNamespace(async_fire=lambda event, data: events.append(data["number"])),
            ),
            push_event=lambda event, data: events.append(data["number"]),
            _notify=notify,
        )
        message = MODULE.LogicalSms(number="beeline\r\n", text="hello", date="2026-09-24")
        self.assertTrue(await scope["_save_logical_sms"](context, message))
        self.assertEqual(saved, ["beeline"])
        self.assertEqual(notified, ["beeline"])
        self.assertEqual(events, ["beeline", "beeline"])


if __name__ == "__main__":
    unittest.main()
