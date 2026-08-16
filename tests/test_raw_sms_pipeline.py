"""Tests for conservative assembly of raw modem records."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest

MODULE_PATH = (
    Path(__file__).parents[1]
    / "custom_components"
    / "sms_gammu_viewer"
    / "raw_sms_pipeline.py"
)
SPEC = importlib.util.spec_from_file_location("raw_sms_pipeline_under_test", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)
RawSmsPart = MODULE.RawSmsPart
assemble_raw_parts = MODULE.assemble_raw_parts
parse_raw_gateway_parts = MODULE.parse_raw_gateway_parts


def part(
    sequence: int,
    text: str,
    *,
    location: int,
    reference: int | None = 42,
    total: int = 2,
    date: str = "2026-08-16T12:00:00",
) -> object:
    return RawSmsPart(
        number="+70000000000",
        smsc="+79990000000",
        reference=reference,
        reference_bits=8 if reference is not None else None,
        sequence=sequence,
        total=total,
        date=date,
        location=location,
        text=text,
        fingerprint=f"fingerprint-{location}",
    )


class RawAssemblyTests(unittest.TestCase):
    def test_parses_gateway_contract_and_rejects_unacknowledgeable_parts(self) -> None:
        parsed = parse_raw_gateway_parts([
            {
                "Number": "+70000000000",
                "SMSC": "+79990000000",
                "Reference": 42,
                "ReferenceBits": 8,
                "PartNumber": 2,
                "PartsExpected": 3,
                "Date": "2026-08-16T12:00:00",
                "Location": 9,
                "Text": "fragment",
                "Fingerprint": "abc",
            },
            {"Location": 10, "Text": "no fingerprint"},
        ])
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0].sequence, 2)
        self.assertEqual(parsed[0].fingerprint, "abc")

    def test_orders_complete_message_by_udh_sequence_not_storage(self) -> None:
        result = assemble_raw_parts([
            part(2, "world", location=3),
            part(1, "hello ", location=8),
        ])
        self.assertEqual(result.complete[0].text, "hello world")
        self.assertEqual(result.complete[0].locations, (8, 3))
        self.assertEqual(
            result.complete[0].fingerprints,
            ("fingerprint-8", "fingerprint-3"),
        )
        self.assertEqual(result.pending, ())

    def test_missing_part_remains_pending_and_is_not_deleted(self) -> None:
        result = assemble_raw_parts([
            part(1, "first", location=1, total=3),
            part(3, "third", location=3, total=3),
        ])
        self.assertEqual(result.complete, ())
        self.assertEqual([item.location for item in result.pending], [1, 3])

    def test_reference_collision_is_quarantined_instead_of_mixed(self) -> None:
        result = assemble_raw_parts([
            part(1, "A1", location=1),
            part(1, "B1", location=2),
            part(2, "A2", location=3),
            part(2, "B2", location=4),
        ])
        self.assertEqual(result.complete, ())
        self.assertEqual(len(result.ambiguous), 4)

    def test_malformed_concat_sequence_is_quarantined(self) -> None:
        result = assemble_raw_parts([
            part(4, "invalid", location=11, total=3)
        ])
        self.assertEqual(result.complete, ())
        self.assertEqual([item.location for item in result.ambiguous], [11])

    def test_reused_reference_outside_window_forms_new_message(self) -> None:
        result = assemble_raw_parts([
            part(1, "old-1", location=1, date="2026-08-16T12:00:00"),
            part(2, "old-2", location=2, date="2026-08-16T12:00:01"),
            part(1, "new-1", location=3, date="2026-08-16T12:10:00"),
            part(2, "new-2", location=4, date="2026-08-16T12:10:01"),
        ])
        self.assertEqual([message.text for message in result.complete], [
            "old-1old-2", "new-1new-2"
        ])

    def test_standalone_message_passes_without_concat_reference(self) -> None:
        result = assemble_raw_parts([
            part(1, "short", location=5, reference=None, total=1)
        ])
        self.assertEqual(result.complete[0].text, "short")
        self.assertEqual(result.complete[0].locations, (5,))


if __name__ == "__main__":
    unittest.main()
