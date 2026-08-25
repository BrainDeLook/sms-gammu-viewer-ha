"""Persistence checks used by the raw-parts acknowledge flow."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import sqlite3
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


class ContactProfileTests(unittest.TestCase):
    def test_brand_logo_override_is_persistent_and_clearable(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = SmsStore(Path(directory) / "sms.db")
            store.init()
            store.set_brand_logo_override("VK.RU", "https://trace-logos.ru/assets/logos/vk.svg")
            self.assertEqual(
                "https://trace-logos.ru/assets/logos/vk.svg",
                store.get_brand_logo_override("VK.RU"),
            )
            store.set_brand_logo_override("VK.RU", "")
            self.assertEqual("", store.get_brand_logo_override("VK.RU"))

    def test_migrates_existing_phonebook_and_preserves_contacts(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            db_path = Path(directory) / "sms.db"
            conn = sqlite3.connect(db_path)
            try:
                with conn:
                    conn.execute(
                        "CREATE TABLE phonebook (number TEXT PRIMARY KEY, "
                        "name TEXT NOT NULL, label TEXT, created_at TEXT NOT NULL)"
                    )
                    conn.execute(
                        "INSERT INTO phonebook VALUES (?, ?, ?, ?)",
                        ("+7000", "Old contact", "mobile", "2026-01-01"),
                    )
            finally:
                conn.close()
            store = SmsStore(db_path)
            store.init()
            contact = store.get_contact("+7000")
            self.assertEqual("Old contact", contact["name"])
            self.assertEqual("", contact["email"])
            self.assertEqual("", contact["avatar"])

    def test_saves_full_profile_and_can_remove_avatar(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = SmsStore(Path(directory) / "sms.db")
            store.init()
            avatar = "data:image/jpeg;base64,abc"
            store.add_contact(
                "+7000", "Daniil", "main", "d@example.com",
                "Home", "2000-01-02", "Notes", avatar,
                [{"method": "Telegram", "value": "@daniil"}, {"method": "Web", "value": "https://example.com"}],
            )
            contact = store.get_contact("+7000")
            self.assertEqual("d@example.com", contact["email"])
            self.assertEqual("Home", contact["company"])
            self.assertEqual(avatar, contact["avatar"])
            self.assertEqual(
                [{"method": "Telegram", "value": "@daniil"}, {"method": "Web", "value": "https://example.com"}],
                contact["custom_methods"],
            )

            store.add_contact("+7000", "New name", avatar=None)
            self.assertEqual(avatar, store.get_contact("+7000")["avatar"])
            store.add_contact("+7000", "New name", avatar="")
            self.assertEqual("", store.get_contact("+7000")["avatar"])


class ChatFolderSettingsTests(unittest.TestCase):
    def test_folder_options_have_safe_defaults_and_are_persistent(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = SmsStore(Path(directory) / "sms.db")
            store.init()
            self.assertEqual(
                {
                    "show_all": True,
                    "people_enabled": False,
                    "brands_enabled": False,
                    "brands_manual": [],
                    "brands_excluded": [],
                    "people_manual": [],
                    "people_excluded": [],
                    "folder_order": [],
                },
                store.get_chat_folder_options(),
            )
            options = {
                "show_all": False,
                "people_enabled": False,
                "brands_enabled": True,
                "brands_manual": ["Mom"],
                "brands_excluded": ["VK.RU"],
                "people_manual": [],
                "people_excluded": [],
                "folder_order": ["people", "brands", "folder-1"],
            }
            store.set_chat_folder_options(options)
            self.assertEqual(options, store.get_chat_folder_options())

    def test_legacy_brands_switch_migrates_to_both_system_folders(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = SmsStore(Path(directory) / "sms.db")
            store.init()

            # This is the shape written by releases before the independent
            # People switch existed.
            store.set_setting(
                "chat_folder_options",
                '{"show_all": false, "brands_enabled": true}',
            )
            self.assertEqual(
                {
                    "show_all": False,
                    "people_enabled": True,
                    "brands_enabled": True,
                    "brands_manual": [],
                    "brands_excluded": [],
                    "people_manual": [],
                    "people_excluded": [],
                    "folder_order": [],
                },
                store.get_chat_folder_options(),
            )

    def test_people_and_brands_switches_persist_independently(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = SmsStore(Path(directory) / "sms.db")
            store.init()
            store.set_chat_folder_options(
                {"people_enabled": True, "brands_enabled": False}
            )
            options = store.get_chat_folder_options()
            self.assertTrue(options["people_enabled"])
            self.assertFalse(options["brands_enabled"])

            # A subsequent update of only Brands must not reset People.
            store.set_chat_folder_options(
                {"people_enabled": True, "brands_enabled": True}
            )
            options = store.get_chat_folder_options()
            self.assertTrue(options["people_enabled"])
            self.assertTrue(options["brands_enabled"])

    def test_legacy_false_switch_keeps_both_system_folders_disabled(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = SmsStore(Path(directory) / "sms.db")
            store.init()
            store.set_setting(
                "chat_folder_options",
                '{"brands_enabled": false}',
            )
            options = store.get_chat_folder_options()
            self.assertFalse(options["people_enabled"])
            self.assertFalse(options["brands_enabled"])


if __name__ == "__main__":
    unittest.main()
