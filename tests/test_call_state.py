"""Tests for standards-based AT+CLCC parsing."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest

MODULE_PATH = (
    Path(__file__).parents[1]
    / "custom_components"
    / "sms_gammu_viewer"
    / "call_state.py"
)
SPEC = importlib.util.spec_from_file_location("call_state_under_test", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)
parse_clcc = MODULE.parse_clcc


class ParseClccTests(unittest.TestCase):
    def test_accepts_arbitrary_modem_call_index(self) -> None:
        calls = parse_clcc('+CLCC: 7,0,3,0,0,"+79990000000",145\r\nOK')
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0].index, 7)
        self.assertTrue(calls[0].is_outgoing)
        self.assertEqual(calls[0].status, 3)

    def test_accepts_spacing_and_mandatory_fields_only(self) -> None:
        calls = parse_clcc(["  +CLCC:  2, 0, 0, 0, 0  ", "OK"])
        self.assertEqual(calls[0].index, 2)
        self.assertEqual(calls[0].status, 0)

    def test_preserves_multiple_calls_and_direction(self) -> None:
        calls = parse_clcc(
            "+CLCC: 3,1,4,0,0\n+CLCC: 9,0,2,0,0\nOK"
        )
        self.assertEqual([call.index for call in calls], [3, 9])
        self.assertFalse(calls[0].is_outgoing)
        self.assertTrue(calls[1].is_outgoing)

    def test_ignores_echo_and_malformed_lines(self) -> None:
        self.assertEqual(parse_clcc("AT+CLCC\n+CLCC: broken\nOK"), ())


if __name__ == "__main__":
    unittest.main()
