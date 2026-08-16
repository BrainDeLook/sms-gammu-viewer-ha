"""Pure helpers for the experimental incoming SMS pipeline.

The gateway already calls ``gammu.LinkSMS``.  Every item returned by ``GET
/sms`` is therefore one logical SMS, not an individual transport part.  This
module deliberately keeps items separate and only decides when a snapshot is
stable enough to consume.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class LogicalSms:
    """One logical SMS as exposed by sms-gammu-gateway."""

    number: str
    text: str
    date: str
    state: str = ""
    complete: bool | None = None
    parts_received: int | None = None
    parts_expected: int | None = None

    @property
    def signature(self) -> tuple:
        """Fields which must remain unchanged while waiting for completion."""
        return (
            self.number,
            self.text,
            self.date,
            self.state,
            self.complete,
            self.parts_received,
            self.parts_expected,
        )


@dataclass(frozen=True, slots=True)
class QueuedLogicalSms:
    """One durable lean-gateway queue item and its immutable ACK ID."""

    id: str
    message: LogicalSms


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _optional_bool(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes", "on"}:
            return True
        if lowered in {"false", "0", "no", "off"}:
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    return None


def parse_gateway_messages(payload: list[dict] | None) -> tuple[LogicalSms, ...]:
    """Normalize a gateway response without merging or reordering messages."""
    messages: list[LogicalSms] = []
    for item in payload or []:
        text = item.get("Text")
        if text is None or text == "":
            continue
        messages.append(
            LogicalSms(
                number=str(item.get("Number") or "Unknown"),
                text=str(text),
                date=str(item.get("Date") or ""),
                state=str(item.get("State") or ""),
                complete=_optional_bool(item.get("Complete")),
                parts_received=_optional_int(item.get("PartsReceived")),
                parts_expected=_optional_int(item.get("PartsExpected")),
            )
        )
    return tuple(messages)


def parse_lean_queue(payload: list[dict] | None) -> tuple[QueuedLogicalSms, ...]:
    """Strictly normalize the durable v1 queue without inventing identity."""
    messages: list[QueuedLogicalSms] = []
    for item in payload or []:
        message_id = str(item.get("ID") or "")
        number = str(item.get("Number") or "")
        date = str(item.get("Date") or "")
        text = item.get("Text")
        if not message_id or not number or not date or text is None:
            continue
        messages.append(
            QueuedLogicalSms(
                id=message_id,
                message=LogicalSms(number=number, text=str(text), date=date),
            )
        )
    return tuple(messages)


def snapshots_equal(
    left: tuple[LogicalSms, ...], right: tuple[LogicalSms, ...]
) -> bool:
    """Return true only for the same logical messages in the same order."""
    return tuple(item.signature for item in left) == tuple(
        item.signature for item in right
    )


@dataclass(frozen=True, slots=True)
class SnapshotObservation:
    messages: tuple[LogicalSms, ...]
    ready: bool
    unchanged_observations: int
    has_completeness_metadata: bool


class SnapshotStabilizer:
    """Wait for explicit completeness or repeated identical snapshots."""

    def __init__(self, required_unchanged: int) -> None:
        self.required_unchanged = max(1, int(required_unchanged))
        self._last: tuple[LogicalSms, ...] = ()
        self._unchanged = 0

    @property
    def last(self) -> tuple[LogicalSms, ...]:
        return self._last

    def observe(self, messages: tuple[LogicalSms, ...]) -> SnapshotObservation:
        if not messages:
            return SnapshotObservation((), False, 0, False)

        if snapshots_equal(messages, self._last):
            self._unchanged += 1
        else:
            self._last = messages
            self._unchanged = 1

        metadata_values = [item.complete for item in messages]
        has_full_metadata = all(value is not None for value in metadata_values)
        explicitly_incomplete = any(value is False for value in metadata_values)

        if explicitly_incomplete:
            ready = False
        elif has_full_metadata:
            ready = True
        else:
            ready = self._unchanged >= self.required_unchanged

        return SnapshotObservation(
            messages=messages,
            ready=ready,
            unchanged_observations=self._unchanged,
            has_completeness_metadata=has_full_metadata,
        )
