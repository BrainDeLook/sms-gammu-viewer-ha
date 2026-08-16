"""Persistence checks used by the raw-parts acknowledge flow."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

MODULE_PATH = (
    Path(__file__).parents[1]
    / "custom_components"
    / "sms_gammu_viewer"
    / "store.py"
)
SPEC = importlib.util.spec_from_file_location("store_under_test", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)
SmsStore = MODULE.SmsStore


class StoreContainsTests(unittest.TestCase):
    def test_contains_confirms_exact_durable_incoming_row(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = SmsStore(Path(directory) / "sms.db")
            store.init()
            message_id = store.add(
                "+7 000 000-00-00", "text", "2026-08-16T12:00:00"
            )
            self.assertIsNotNone(message_id)
            self.assertTrue(store.contains(
                "+7 000 000-00-00", "text", "2026-08-16T12:00:00"
            ))
            self.assertFalse(store.contains(
                "+7 000 000-00-00", "other", "2026-08-16T12:00:00"
            ))

    def test_duplicate_is_still_confirmed_for_safe_ack_retry(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = SmsStore(Path(directory) / "sms.db")
            store.init()
            args = ("Sender", "same", "2026-08-16T12:00:00")
            self.assertIsNotNone(store.add(*args))
            self.assertIsNone(store.add(*args))
            self.assertTrue(store.contains(*args))


if __name__ == "__main__":
    unittest.main()
