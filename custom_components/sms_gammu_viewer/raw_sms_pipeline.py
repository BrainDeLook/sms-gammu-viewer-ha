"""Deterministic assembly for an experimental raw-parts gateway API.

Unlike ``gammu.LinkSMS``, this code never guesses when a concat reference is
ambiguous. A collision stays pending instead of producing mixed text.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable


@dataclass(frozen=True, slots=True)
class RawSmsPart:
    number: str
    smsc: str
    reference: int | None
    reference_bits: int | None
    sequence: int
    total: int
    date: str
    location: int
    text: str
    fingerprint: str

    @property
    def concat_key(self) -> tuple[str, str, int | None, int | None, int]:
        return (
            self.number,
            self.smsc,
            self.reference_bits,
            self.reference,
            self.total,
        )


@dataclass(frozen=True, slots=True)
class AssembledSms:
    number: str
    text: str
    date: str
    locations: tuple[int, ...]
    fingerprints: tuple[str, ...]
    parts: int


@dataclass(frozen=True, slots=True)
class AssemblyResult:
    complete: tuple[AssembledSms, ...]
    pending: tuple[RawSmsPart, ...]
    ambiguous: tuple[RawSmsPart, ...]


def _timestamp(value: str) -> float:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError, OverflowError):
        return 0.0


def _part_order(part: RawSmsPart) -> tuple[float, int]:
    return (_timestamp(part.date), part.location)


def _integer(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def parse_raw_gateway_parts(payload: list[dict] | None) -> tuple[RawSmsPart, ...]:
    """Normalize the proposed `/sms/raw` response."""
    parts: list[RawSmsPart] = []
    for item in payload or []:
        location = _integer(item.get("Location"), -1)
        fingerprint = str(item.get("Fingerprint") or "")
        if location < 0 or not fingerprint:
            continue
        reference_value = item.get("Reference")
        reference = None if reference_value is None else _integer(reference_value)
        parts.append(
            RawSmsPart(
                number=str(item.get("Number") or "Unknown"),
                smsc=str(item.get("SMSC") or ""),
                reference=reference,
                reference_bits=(
                    None
                    if item.get("ReferenceBits") is None
                    else _integer(item.get("ReferenceBits"))
                ),
                sequence=_integer(item.get("PartNumber"), 1),
                total=max(1, _integer(item.get("PartsExpected"), 1)),
                date=str(item.get("Date") or ""),
                location=location,
                text=str(item.get("Text") or ""),
                fingerprint=fingerprint,
            )
        )
    return tuple(parts)


def _clusters(
    parts: Iterable[RawSmsPart], collision_window_seconds: int
) -> list[list[RawSmsPart]]:
    ordered = sorted(parts, key=_part_order)
    clusters: list[list[RawSmsPart]] = []
    for part in ordered:
        if not clusters:
            clusters.append([part])
            continue
        previous = clusters[-1][-1]
        gap = _timestamp(part.date) - _timestamp(previous.date)
        if gap > collision_window_seconds:
            clusters.append([part])
        else:
            clusters[-1].append(part)
    return clusters


def assemble_raw_parts(
    parts: Iterable[RawSmsPart], *, collision_window_seconds: int = 300
) -> AssemblyResult:
    """Assemble only unambiguous, complete UDH sequences.

    Multipart candidates are keyed by sender, SMSC, 8/16-bit reference and
    expected count, then separated by a time window. If a time cluster has
    duplicate sequence numbers, no pairing can be proven from UDH alone; the
    whole cluster is quarantined as ambiguous rather than mixed.
    """
    complete: list[AssembledSms] = []
    pending: list[RawSmsPart] = []
    ambiguous: list[RawSmsPart] = []
    multipart: dict[tuple, list[RawSmsPart]] = {}

    for part in parts:
        if part.reference is None or part.total <= 1:
            complete.append(
                AssembledSms(
                    number=part.number,
                    text=part.text,
                    date=part.date,
                    locations=(part.location,),
                    fingerprints=(part.fingerprint,),
                    parts=1,
                )
            )
            continue
        multipart.setdefault(part.concat_key, []).append(part)

    for candidates in multipart.values():
        for cluster in _clusters(candidates, collision_window_seconds):
            by_sequence: dict[int, list[RawSmsPart]] = {}
            invalid = False
            for part in cluster:
                if part.sequence < 1 or part.sequence > part.total:
                    invalid = True
                by_sequence.setdefault(part.sequence, []).append(part)

            if invalid or any(len(items) != 1 for items in by_sequence.values()):
                ambiguous.extend(cluster)
                continue

            expected = set(range(1, cluster[0].total + 1))
            if set(by_sequence) != expected:
                pending.extend(cluster)
                continue

            ordered = [by_sequence[index][0] for index in sorted(expected)]
            complete.append(
                AssembledSms(
                    number=ordered[0].number,
                    text="".join(part.text for part in ordered),
                    date=min(ordered, key=_part_order).date,
                    locations=tuple(part.location for part in ordered),
                    fingerprints=tuple(part.fingerprint for part in ordered),
                    parts=len(ordered),
                )
            )

    complete.sort(
        key=lambda message: (
            _timestamp(message.date),
            min(message.locations, default=0),
        )
    )
    pending.sort(key=_part_order)
    ambiguous.sort(key=_part_order)
    return AssemblyResult(tuple(complete), tuple(pending), tuple(ambiguous))
