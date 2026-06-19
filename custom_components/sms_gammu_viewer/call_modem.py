"""Низкоуровневый AT-клиент для голосового serial-интерфейса модема (например /dev/serial/.../if02)."""
from __future__ import annotations

import asyncio
import logging

_LOGGER = logging.getLogger(__name__)

READ_LIMIT = 2**16  # 64 KiB


class CallModem:
    """Минималистичный AT-клиент поверх отдельного serial-порта для звонков."""

    DEFAULT_EOL = "\r\n"

    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        self.reader = reader
        self.writer = writer

    async def execute_at(
        self,
        command: str,
        timeout: float,
        end_markers: list[str],
        terminator: str = DEFAULT_EOL,
    ) -> list[str]:
        await self.send_command(command, terminator)
        return await self._read_response(timeout, end_markers)

    async def send_command(self, command: str, terminator: str = DEFAULT_EOL) -> None:
        _LOGGER.debug("AT >> %s", command)
        self.writer.write(f"{command}{terminator}".encode())
        await self.writer.drain()

    async def _read_response(self, timeout: float, end_markers: list[str]) -> list[str]:
        lines: list[str] = []
        try:
            async with asyncio.timeout(timeout):
                while True:
                    line = await self.reader.readline()
                    decoded = line.decode(errors="ignore").strip()
                    if not decoded:
                        continue
                    lines.append(decoded)
                    _LOGGER.debug("AT << %s", decoded)
                    if any(decoded == m or decoded.startswith(m) for m in end_markers):
                        return lines
        except TimeoutError:
            _LOGGER.debug("AT read timeout, collected %d line(s)", len(lines))
            return lines

    async def close(self) -> None:
        try:
            self.writer.close()
            await self.writer.wait_closed()
        except Exception as e:
            _LOGGER.debug("Error closing call modem connection: %s", e)

