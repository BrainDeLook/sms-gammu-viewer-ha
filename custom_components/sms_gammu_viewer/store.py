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
                    is_read   INTEGER NOT NULL DEFAULT 0,
                    UNIQUE(number, date, text)
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_number ON messages(number)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_date   ON messages(date)")
            try:
                conn.execute(
                    "CREATE UNIQUE INDEX IF NOT EXISTS idx_dedup ON messages(number, date, text)"
                )
            except Exception:
                pass

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._path)
        conn.row_factory = sqlite3.Row
        return conn

    def add(self, number: str, text: str, date: str) -> int | None:
        """Возвращает id только если SMS реально новый, None если дубликат."""
        received = datetime.now().isoformat(timespec="seconds")
        try:
            with self._conn() as conn:
                # Точный дубликат
                cur = conn.execute(
                    "INSERT OR IGNORE INTO messages (number, text, date, received, is_read) VALUES (?,?,?,?,0)",
                    (number, text, date, received),
                )
                if cur.rowcount > 0:
                    return cur.lastrowid

                # Частичный дубликат: новый текст является началом или концом уже сохранённого
                # (промежуточная версия multipart SMS которая уже обновилась до полной)
                existing = conn.execute(
                    "SELECT id, text FROM messages WHERE number=? AND date=?",
                    (number, date),
                ).fetchall()
                for row in existing:
                    saved_text = row[1]
                    if saved_text.startswith(text) or text.startswith(saved_text):
                        # Если новый текст длиннее — обновляем
                        if len(text) > len(saved_text):
                            conn.execute(
                                "UPDATE messages SET text=? WHERE id=?",
                                (text, row[0]),
                            )
                            return row[0]
                        return None
                return None
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

    def find_recent(self, number: str, within_seconds: int = 120) -> dict | None:
        """Ищет последнее сообщение от номера за последние N секунд."""
        from datetime import datetime, timedelta
        cutoff = (datetime.now() - timedelta(seconds=within_seconds)).isoformat(timespec="seconds")
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM messages WHERE number=? AND received >= ? ORDER BY id DESC LIMIT 1",
                (number, cutoff),
            ).fetchone()
        return dict(row) if row else None

    def append_text(self, msg_id: int, extra_text: str) -> None:
        """Дописывает текст к существующему сообщению."""
        with self._conn() as conn:
            conn.execute(
                "UPDATE messages SET text = text || ? WHERE id = ?",
                (extra_text, msg_id),
            )

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
