"""Логика дозвона по AT-командам: ATD, опрос AT+CLCC, пассивное ожидание."""
from __future__ import annotations

import asyncio
import logging
import re
from enum import Enum

import serial
import serial_asyncio_fast as serial_asyncio

from .call_modem import READ_LIMIT, CallModem

_LOGGER = logging.getLogger(__name__)

PHONE_NUMBER_RE = re.compile(r"^\+?[1-9]\d{1,14}$")

DEFAULT_DIAL_TIMEOUT_SEC = 25
DEFAULT_CALL_DURATION_SEC = 30
DEFAULT_BAUDRATE = 75600


class CallEndedReason(str, Enum):
    NOT_ANSWERED = "not_answered"
    DECLINED = "declined"
    ANSWERED = "answered"
    ERROR = "error"


class DialError(Exception):
    pass


def validate_phone_number(phone_number: str) -> str:
    cleaned = phone_number.strip()
    if not PHONE_NUMBER_RE.match(cleaned):
        raise DialError(f"Invalid phone number: {phone_number}")
    return re.sub(r"\D", "", cleaned)


async def _connect(device_path: str, baudrate: int = DEFAULT_BAUDRATE) -> CallModem:
    _LOGGER.debug("Connecting to call interface %s...", device_path)
    reader, writer = await serial_asyncio.open_serial_connection(
        url=device_path,
        baudrate=baudrate,
        bytesize=serial.EIGHTBITS,
        parity=serial.PARITY_NONE,
        stopbits=serial.STOPBITS_ONE,
        dsrdtr=True,
        rtscts=True,
        limit=READ_LIMIT,
    )
    return CallModem(reader, writer)


async def dial_number(
    device_path: str,
    phone_number: str,
    dial_timeout_sec: int = DEFAULT_DIAL_TIMEOUT_SEC,
    call_duration_sec: int = DEFAULT_CALL_DURATION_SEC,
) -> CallEndedReason:
    """Дозванивается до номера через указанный голосовой serial-порт.

    Возвращает причину завершения звонка.
    """
    number = validate_phone_number(phone_number)
    modem: CallModem | None = None

    try:
        modem = await _connect(device_path)

        _LOGGER.info("Dialing +%s...", number)
        lines = await modem.execute_at(
            f"ATD+{number};",
            timeout=10,
            end_markers=["OK", "ERROR", "BUSY", "NO CARRIER", "+CME ERROR"],
        )
        reply = " ".join(lines)
        _LOGGER.debug("Dial reply: %s", reply)

        if "BUSY" in reply:
            return CallEndedReason.DECLINED
        if "ERROR" in reply or "NO CARRIER" in reply:
            _LOGGER.warning("Modem error on dial: %s", reply)
            return CallEndedReason.ERROR

        reason = await _wait_for_call_end(modem, dial_timeout_sec, call_duration_sec)

        _LOGGER.debug("Hanging up...")
        await modem.execute_at(
            "AT+CHUP", timeout=5,
            end_markers=["OK", "ERROR", "NO CARRIER", "+CME ERROR"],
        )
        await asyncio.sleep(1)

        _LOGGER.info("Call to +%s ended: %s", number, reason)
        return reason

    except asyncio.TimeoutError:
        _LOGGER.warning("Timeout while dialing +%s", number)
        return CallEndedReason.ERROR
    except Exception as e:
        _LOGGER.error("Dial error: %s", e)
        return CallEndedReason.ERROR
    finally:
        if modem:
            await modem.close()


async def hangup(device_path: str) -> bool:
    """Принудительно завершает текущий звонок (если есть)."""
    modem: CallModem | None = None
    try:
        modem = await _connect(device_path)
        await modem.execute_at(
            "AT+CHUP", timeout=5,
            end_markers=["OK", "ERROR", "NO CARRIER", "+CME ERROR"],
        )
        return True
    except Exception as e:
        _LOGGER.error("Hangup error: %s", e)
        return False
    finally:
        if modem:
            await modem.close()


async def check_port(device_path: str) -> dict:
    """Диагностика голосового порта: открывается ли, отвечает ли на AT.

    Возвращает словарь с полями ok, error, response_time_ms.
    """
    if not device_path or not device_path.strip():
        return {"ok": False, "error": "not_configured"}

    import time
    start = time.monotonic()
    modem: CallModem | None = None

    try:
        modem = await _connect(device_path)
        lines = await modem.execute_at(
            "AT", timeout=5, end_markers=["OK", "ERROR"]
        )
        elapsed_ms = round((time.monotonic() - start) * 1000)
        reply = " ".join(lines)

        if "OK" in reply:
            return {"ok": True, "response_time_ms": elapsed_ms}

        return {"ok": False, "error": "no_ok_response", "raw": reply}

    except FileNotFoundError:
        return {"ok": False, "error": "device_not_found"}
    except PermissionError:
        return {"ok": False, "error": "permission_denied"}
    except Exception as e:
        return {"ok": False, "error": "connection_failed", "detail": str(e)}
    finally:
        if modem:
            await modem.close()


async def _wait_for_call_end(
    modem: CallModem, dial_timeout_sec: int, call_duration_sec: int
) -> CallEndedReason:
    """Пытается опрашивать AT+CLCC, при отсутствии поддержки — пассивное ожидание."""
    lines = await modem.execute_at(
        "AT+CLCC", timeout=2, end_markers=["OK", "ERROR", "+CME ERROR"]
    )
    reply = " ".join(lines)
    _LOGGER.debug("CLCC probe: %s", reply)

    if "+CLCC:" in reply or ("OK" in reply and len(lines) > 1):
        return await _poll_clcc(modem, reply, dial_timeout_sec, call_duration_sec)

    _LOGGER.info("AT+CLCC not supported, passive wait %ss", call_duration_sec)
    return await _passive_wait(modem, call_duration_sec)


async def _poll_clcc(
    modem: CallModem, initial_reply: str, dial_timeout_sec: int, call_duration_sec: int
) -> CallEndedReason:
    is_ringing = False
    reply = initial_reply

    try:
        async with asyncio.timeout(dial_timeout_sec) as cm:
            while True:
                if not is_ringing and "+CLCC: 1,0,3" in reply:
                    is_ringing = True
                    _LOGGER.info("Ringing, waiting up to %ss for answer", call_duration_sec)
                    cm.reschedule(asyncio.get_running_loop().time() + call_duration_sec)
                elif "+CLCC: 1,0,0" in reply:
                    return CallEndedReason.ANSWERED
                elif "ERROR" in reply:
                    return CallEndedReason.NOT_ANSWERED
                elif "+CLCC:" not in reply:
                    return CallEndedReason.NOT_ANSWERED if is_ringing else CallEndedReason.DECLINED

                await asyncio.sleep(1)
                lines = await modem.execute_at(
                    "AT+CLCC", timeout=2, end_markers=["OK", "ERROR", "+CME ERROR"]
                )
                reply = " ".join(lines)
    except TimeoutError:
        return CallEndedReason.NOT_ANSWERED


async def _passive_wait(modem: CallModem, call_duration_sec: int) -> CallEndedReason:
    try:
        async with asyncio.timeout(call_duration_sec):
            while True:
                line = await modem.reader.readline()
                decoded = line.decode(errors="ignore").strip()
                if not decoded:
                    continue
                _LOGGER.debug("URC: %s", decoded)
                if "NO CARRIER" in decoded or "BUSY" in decoded:
                    return CallEndedReason.DECLINED
    except TimeoutError:
        return CallEndedReason.NOT_ANSWERED





