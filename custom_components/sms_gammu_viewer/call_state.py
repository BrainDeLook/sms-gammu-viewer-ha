"""Pure parser for the 3GPP/ETSI ``AT+CLCC`` response."""
from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Iterable


# +CLCC: <idx>,<dir>,<stat>,<mode>,<mpty>[,"<number>",<type>]
# Only the mandatory fields are needed for call-state tracking.  In
# particular, <idx> is allocated by the modem and is not guaranteed to be 1.
_CLCC_RE = re.compile(
    r"^\s*\+CLCC:\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,"
    r"\s*(\d+)\s*,\s*(\d+)\s*(?:,.*)?$",
    re.IGNORECASE,
)


@dataclass(frozen=True, slots=True)
class ClccCall:
    index: int
    direction: int
    status: int
    mode: int
    multiparty: int

    @property
    def is_outgoing(self) -> bool:
        return self.direction == 0


def parse_clcc(lines: str | Iterable[str]) -> tuple[ClccCall, ...]:
    """Parse every call in a CLCC response, preserving modem order."""
    source = lines.splitlines() if isinstance(lines, str) else lines
    calls: list[ClccCall] = []
    for line in source:
        match = _CLCC_RE.match(line)
        if not match:
            continue
        calls.append(ClccCall(*(int(value) for value in match.groups())))
    return tuple(calls)
