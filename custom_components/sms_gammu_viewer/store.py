"""SQLite хранилище SMS внутри Home Assistant."""
from __future__ import annotations

import sqlite3
import logging
from pathlib import Path
from datetime import datetime
from typing import Any

_LOGGER = logging.getLogger(__name__)


class SmsStore:
    def __init__(self, db_path: Path) -> None:
        self._path = str(db_path)

    def init(self) -> None:
        with self._conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id        INTEGER PRIMARY KEY AUTOINCREMENT,
                    number    TEXT NOT NULL,
                    text      TEXT NOT NULL,
                    date      TEXT NOT NULL,
                    received  TEXT NOT NULL,
                    is_read   INTEGER NOT NULL DEFAULT 0
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_number ON messages(number)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_date   ON messages(date)")

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._path)
        conn.row_factory = sqlite3.Row
        return conn

    def add(self, number: str, text: str, date: str) -> int | None:
        received = datetime.now().isoformat(timespec="seconds")
        try:
            with self._conn() as conn:
                cur = conn.execute(
                    "INSERT INTO messages (number, text, date, received, is_read) VALUES (?,?,?,?,0)",
                    (number, text, date),
                )
                return cur.lastrowid
        except Exception as e:
            _LOGGER.error("SmsStore.add error: %s", e)
            return None

    def mark_read(self, msg_id: int) -> None:
        with self._conn() as conn:
            conn.execute("UPDATE messages SET is_read=1 WHERE id=?", (msg_id,))

    def delete(self, msg_id: int) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM messages WHERE id=?", (msg_id,))

    def delete_by_number(self, number: str) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM messages WHERE number=?", (number,))

    def get_all(self) -> list[dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM messages ORDER BY date DESC, id DESC"
            ).fetchall()
        return [dict(r) for r in rows]

    def get_by_number(self, number: str) -> list[dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM messages WHERE number=? ORDER BY date ASC, id ASC",
                (number,),
            ).fetchall()
        return [dict(r) for r in rows]

    def get_contacts(self) -> list[dict[str, Any]]:
        """Список уникальных номеров с последним SMS и количеством непрочитанных."""
        with self._conn() as conn:
            rows = conn.execute("""
                SELECT
                    number,
                    COUNT(*) as total,
                    SUM(CASE WHEN is_read=0 THEN 1 ELSE 0 END) as unread,
                    MAX(date) as last_date,
                    (SELECT text FROM messages m2
                     WHERE m2.number = m.number
                     ORDER BY date DESC, id DESC LIMIT 1) as last_text
                FROM messages m
                GROUP BY number
                ORDER BY last_date DESC
            """).fetchall()
        return [dict(r) for r in rows]

    def unread_count(self) -> int:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT COUNT(*) FROM messages WHERE is_read=0"
            ).fetchone()
        return row[0] if row else 0
