"""SQLite хранилище SMS внутри Home Assistant."""
from __future__ import annotations

import sqlite3
import logging
import json
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from datetime import datetime
from typing import Any

_LOGGER = logging.getLogger(__name__)


class SmsStore:
    def __init__(self, db_path: Path) -> None:
        self._path = str(db_path)

    def init(self) -> None:
        with self._conn() as conn:
            # WAL — быстрее при параллельных чтениях (фронтенд + координатор)
            conn.execute("PRAGMA journal_mode=WAL")

            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id        INTEGER PRIMARY KEY AUTOINCREMENT,
                    number    TEXT NOT NULL,
                    text      TEXT NOT NULL,
                    date      TEXT NOT NULL,
                    received  TEXT NOT NULL,
                    is_read   INTEGER NOT NULL DEFAULT 0,
                    direction TEXT NOT NULL DEFAULT 'in',
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

            # Миграция: добавляем колонку direction если её ещё нет (обновление с старой версии)
            try:
                conn.execute("ALTER TABLE messages ADD COLUMN direction TEXT NOT NULL DEFAULT 'in'")
                _LOGGER.info("Migrated messages table: added direction column")
            except Exception:
                pass  # Колонка уже существует

            conn.execute("""
                CREATE TABLE IF NOT EXISTS muted_numbers (
                    number TEXT PRIMARY KEY,
                    muted_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS call_history (
                    id        INTEGER PRIMARY KEY AUTOINCREMENT,
                    number    TEXT NOT NULL,
                    reason    TEXT NOT NULL,
                    called_at TEXT NOT NULL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_call_number ON call_history(number)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_call_date   ON call_history(called_at)")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key   TEXT PRIMARY KEY,
                    value TEXT
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS phonebook (
                    number    TEXT PRIMARY KEY,
                    name      TEXT NOT NULL,
                    label     TEXT,
                    created_at TEXT NOT NULL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_phonebook_name ON phonebook(name)")
            # Расширенный профиль контакта. ALTER оставляет старую телефонную
            # книгу полностью совместимой и не требует отдельной миграции БД.
            for column, declaration in (
                ("email", "TEXT NOT NULL DEFAULT ''"),
                ("company", "TEXT NOT NULL DEFAULT ''"),
                ("birthday", "TEXT NOT NULL DEFAULT ''"),
                ("notes", "TEXT NOT NULL DEFAULT ''"),
                ("avatar", "TEXT NOT NULL DEFAULT ''"),
                ("custom_methods", "TEXT NOT NULL DEFAULT '[]'"),
                ("updated_at", "TEXT NOT NULL DEFAULT ''"),
            ):
                try:
                    conn.execute(
                        f"ALTER TABLE phonebook ADD COLUMN {column} {declaration}"
                    )
                    _LOGGER.info("Migrated phonebook table: added %s", column)
                except sqlite3.OperationalError:
                    pass
            # Эти таблицы раньше создавались лениво в get_contacts /
            # get_messages_with_starred — из-за этого pin_number/star_message
            # падали с "no such table", если вызывались раньше первого чтения
            conn.execute("CREATE TABLE IF NOT EXISTS pinned_numbers (number TEXT PRIMARY KEY)")
            conn.execute("CREATE TABLE IF NOT EXISTS starred_messages (msg_id INTEGER PRIMARY KEY)")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS brand_logo_overrides (
                    number     TEXT PRIMARY KEY,
                    source_url TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)

            # Миграция: чистим номера с переводами строк/лишними пробелами
            try:
                self._migrate_clean_numbers(conn)
            except Exception as e:
                _LOGGER.warning("Number cleanup migration failed: %s", e)

    def _migrate_clean_numbers(self, conn: sqlite3.Connection) -> None:
        rows = conn.execute(
            "SELECT DISTINCT number FROM messages WHERE number LIKE '%' || char(10) || '%' "
            "OR number LIKE '%' || char(13) || '%'"
        ).fetchall()
        for row in rows:
            old_number = row[0]
            new_number = self._sanitize_number(old_number)
            if new_number == old_number:
                continue
            _LOGGER.info("Cleaning up number: %r -> %r", old_number, new_number)
            existing_ids = conn.execute(
                "SELECT id, date, text FROM messages WHERE number=?", (old_number,)
            ).fetchall()
            for r in existing_ids:
                try:
                    conn.execute(
                        "UPDATE messages SET number=? WHERE id=?",
                        (new_number, r[0]),
                    )
                except sqlite3.IntegrityError:
                    conn.execute("DELETE FROM messages WHERE id=?", (r[0],))

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        """Соединение с автокоммитом (rollback при исключении) и гарантированным close.

        Голый ``with sqlite3.connect(...)`` управляет только транзакцией и
        НЕ закрывает соединение — без явного close файловые дескрипторы
        копились бы до срабатывания GC.
        """
        conn = sqlite3.connect(self._path)
        conn.row_factory = sqlite3.Row
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    @staticmethod
    def _sanitize_number(number: str) -> str:
        """Убирает переводы строк и лишние пробелы из номера/имени отправителя."""
        if not number:
            return number
        cleaned = number.replace("\r", " ").replace("\n", " ")
        cleaned = " ".join(cleaned.split())
        return cleaned

    def add(self, number: str, text: str, date: str) -> int | None:
        """Добавляет входящее SMS. Возвращает id только если реально новый, None если дубликат."""
        number = self._sanitize_number(number)
        received = datetime.now().isoformat(timespec="seconds")
        try:
            with self._conn() as conn:
                cur = conn.execute(
                    "INSERT OR IGNORE INTO messages (number, text, date, received, is_read, direction) VALUES (?,?,?,?,0,'in')",
                    (number, text, date, received),
                )
                if cur.rowcount > 0:
                    return cur.lastrowid

                # Частичный дубликат: новый текст является началом уже сохранённого
                existing = conn.execute(
                    "SELECT id, text FROM messages WHERE number=? AND date=? AND direction='in'",
                    (number, date),
                ).fetchall()
                for row in existing:
                    saved_text = row[1]
                    if saved_text.startswith(text) or text.startswith(saved_text):
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

    def contains(self, number: str, text: str, date: str) -> bool:
        """Check that an incoming message is durably present before modem ACK."""
        number = self._sanitize_number(number)
        try:
            with self._conn() as conn:
                row = conn.execute(
                    "SELECT 1 FROM messages WHERE number=? AND text=? AND date=? "
                    "AND direction='in' LIMIT 1",
                    (number, text, date),
                ).fetchone()
            return row is not None
        except Exception as e:
            _LOGGER.error("SmsStore.contains error: %s", e)
            return False

    def add_outgoing(self, number: str, text: str) -> int | None:
        """Сохраняет исходящее SMS в историю чата."""
        number = self._sanitize_number(number)
        now = datetime.now().isoformat(timespec="seconds")
        try:
            with self._conn() as conn:
                cur = conn.execute(
                    "INSERT INTO messages (number, text, date, received, is_read, direction) VALUES (?,?,?,?,1,'out')",
                    (number, text, now, now),
                )
                return cur.lastrowid
        except Exception as e:
            _LOGGER.error("SmsStore.add_outgoing error: %s", e)
            return None

    def mark_read(self, msg_id: int) -> None:
        with self._conn() as conn:
            conn.execute("UPDATE messages SET is_read=1 WHERE id=?", (msg_id,))

    def mark_read_by_number(self, number: str) -> None:
        with self._conn() as conn:
            conn.execute("UPDATE messages SET is_read=1 WHERE number=?", (number,))

    def pin_number(self, number: str) -> None:
        with self._conn() as conn:
            conn.execute("INSERT OR IGNORE INTO pinned_numbers (number) VALUES (?)", (number,))

    def unpin_number(self, number: str) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM pinned_numbers WHERE number=?", (number,))

    def delete(self, msg_id: int) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM messages WHERE id=?", (msg_id,))

    def delete_by_number(self, number: str) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM messages WHERE number=?", (number,))

    def find_recent(self, number: str, within_seconds: int = 120) -> dict | None:
        """Ищет последнее входящее сообщение от номера за последние N секунд."""
        from datetime import datetime, timedelta
        # add() сохраняет санитизированный номер — ищем по такому же,
        # иначе alpha-tag с переводами строк никогда не найдётся
        number = self._sanitize_number(number)
        cutoff = (datetime.now() - timedelta(seconds=within_seconds)).isoformat(timespec="seconds")
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM messages WHERE number=? AND received >= ? AND direction='in' ORDER BY id DESC LIMIT 1",
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
        """Список уникальных номеров с последним SMS, непрочитанными, mute-статусом и именем из книги.
        
        unread считает только входящие непрочитанные (direction='in').
        """
        with self._conn() as conn:
            rows = conn.execute("""
                SELECT
                    m.number as number,
                    COUNT(*) as total,
                    SUM(CASE WHEN is_read=0 AND direction='in' THEN 1 ELSE 0 END) as unread,
                    MAX(m.received) as last_activity,
                    (SELECT date FROM messages m2
                     WHERE m2.number = m.number
                     ORDER BY id DESC LIMIT 1) as last_date,
                    (SELECT text FROM messages m2
                     WHERE m2.number = m.number
                     ORDER BY id DESC LIMIT 1) as last_text,
                    (SELECT direction FROM messages m3
                     WHERE m3.number = m.number
                     ORDER BY id DESC LIMIT 1) as last_direction,
                    (SELECT 1 FROM muted_numbers mn WHERE mn.number = m.number) as is_muted,
                    pb.name as contact_name,
                    pb.label as contact_label,
                    (SELECT source_url FROM brand_logo_overrides blo
                     WHERE blo.number = m.number) as brand_logo_url,
                    (SELECT 1 FROM pinned_numbers pn WHERE pn.number = m.number) as is_pinned
                FROM messages m
                LEFT JOIN phonebook pb ON pb.number = m.number
                GROUP BY m.number
                ORDER BY is_pinned DESC, last_activity DESC
            """).fetchall()
        result = [dict(r) for r in rows]
        for r in result:
            r["is_muted"] = bool(r["is_muted"])
            r["is_pinned"] = bool(r["is_pinned"])
        return result

    def clear_all(self) -> None:
        """Удаляет все сообщения из базы данных."""
        with self._conn() as conn:
            conn.execute("DELETE FROM messages")

    def star_message(self, msg_id: int) -> None:
        with self._conn() as conn:
            conn.execute("INSERT OR IGNORE INTO starred_messages (msg_id) VALUES (?)", (msg_id,))

    def unstar_message(self, msg_id: int) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM starred_messages WHERE msg_id=?", (msg_id,))

    def is_starred(self, msg_id: int) -> bool:
        with self._conn() as conn:
            row = conn.execute("SELECT 1 FROM starred_messages WHERE msg_id=?", (msg_id,)).fetchone()
            return row is not None

    def get_messages_with_starred(self, number: str):
        with self._conn() as conn:
            rows = conn.execute("""
                SELECT m.*, EXISTS(SELECT 1 FROM starred_messages s WHERE s.msg_id = m.id) as is_starred
                FROM messages m WHERE m.number=? ORDER BY date ASC, id ASC
            """, (number,)).fetchall()
        return [dict(r) for r in rows]

    def get_message_count(self) -> int:
        with self._conn() as conn:
            row = conn.execute("SELECT COUNT(*) FROM messages").fetchone()
            return row[0] if row else 0

    def unread_count(self) -> int:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT COUNT(*) FROM messages WHERE is_read=0 AND direction='in'"
            ).fetchone()
        return row[0] if row else 0

    def mute(self, number: str) -> None:
        with self._conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO muted_numbers (number, muted_at) VALUES (?, ?)",
                (number, datetime.now().isoformat(timespec="seconds")),
            )

    def unmute(self, number: str) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM muted_numbers WHERE number=?", (number,))

    def is_muted(self, number: str) -> bool:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT 1 FROM muted_numbers WHERE number=?", (number,)
            ).fetchone()
        return row is not None

    def get_muted_numbers(self) -> list[str]:
        with self._conn() as conn:
            rows = conn.execute("SELECT number FROM muted_numbers").fetchall()
        return [r[0] for r in rows]

    def add_call(self, number: str, reason: str) -> int | None:
        """Записывает звонок в историю."""
        try:
            with self._conn() as conn:
                cur = conn.execute(
                    "INSERT INTO call_history (number, reason, called_at) VALUES (?, ?, ?)",
                    (number, reason, datetime.now().isoformat(timespec="seconds")),
                )
                return cur.lastrowid
        except Exception as e:
            _LOGGER.error("SmsStore.add_call error: %s", e)
            return None

    def get_call_history(self, limit: int = 30) -> list[dict[str, Any]]:
        """Последние звонки, новые сверху, с именем из телефонной книги."""
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT ch.*, pb.name as contact_name
                FROM call_history ch
                LEFT JOIN phonebook pb ON pb.number = ch.number
                ORDER BY ch.id DESC LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    def delete_call(self, call_id: int) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM call_history WHERE id=?", (call_id,))

    def clear_call_history(self) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM call_history")

    def get_setting(self, key: str) -> str | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT value FROM settings WHERE key=?", (key,)
            ).fetchone()
        return row[0] if row else None

    def set_setting(self, key: str, value: str) -> None:
        with self._conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                (key, value),
            )

    def get_chat_folders(self) -> list[dict[str, Any]]:
        """Return persisted chat folders, keeping malformed data safe."""
        raw = self.get_setting("chat_folders")
        if not raw:
            return []
        try:
            value = json.loads(raw)
        except (TypeError, ValueError):
            return []
        return value if isinstance(value, list) else []

    def set_chat_folders(self, folders: list[dict[str, Any]]) -> None:
        self.set_setting("chat_folders", json.dumps(folders, ensure_ascii=False))

    def set_brand_logo_override(self, number: str, source_url: str) -> None:
        """Persist or clear the manually selected logo for an SMS sender."""
        number = self._sanitize_number(number)
        with self._conn() as conn:
            if source_url:
                conn.execute(
                    "INSERT OR REPLACE INTO brand_logo_overrides "
                    "(number, source_url, updated_at) VALUES (?, ?, ?)",
                    (number, source_url, datetime.now().isoformat(timespec="seconds")),
                )
            else:
                conn.execute(
                    "DELETE FROM brand_logo_overrides WHERE number=?", (number,)
                )

    def get_brand_logo_override(self, number: str) -> str:
        number = self._sanitize_number(number)
        with self._conn() as conn:
            row = conn.execute(
                "SELECT source_url FROM brand_logo_overrides WHERE number=?", (number,)
            ).fetchone()
        return row[0] if row else ""

    # ─── Телефонная книга ───────────────────────────────────────────

    def add_contact(
        self,
        number: str,
        name: str,
        label: str = "",
        email: str = "",
        company: str = "",
        birthday: str = "",
        notes: str = "",
        avatar: str | None = None,
        custom_methods: list[dict[str, str]] | None = None,
    ) -> None:
        number = self._sanitize_number(number)
        now = datetime.now().isoformat(timespec="seconds")
        custom_methods_json = json.dumps(custom_methods, ensure_ascii=False) if custom_methods is not None else None
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO phonebook (
                    number, name, label, email, company, birthday, notes,
                    avatar, custom_methods, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, '[]'), ?, ?)
                ON CONFLICT(number) DO UPDATE SET
                    name=excluded.name,
                    label=excluded.label,
                    email=excluded.email,
                    company=excluded.company,
                    birthday=excluded.birthday,
                    notes=excluded.notes,
                    custom_methods=CASE
                        WHEN ? IS NULL THEN phonebook.custom_methods
                        ELSE excluded.custom_methods
                    END,
                    avatar=CASE
                        WHEN ? IS NULL THEN phonebook.avatar
                        ELSE excluded.avatar
                    END,
                    updated_at=excluded.updated_at
                """,
                (
                    number, name, label, email, company, birthday, notes,
                    avatar or "", custom_methods_json,
                    now, now, custom_methods_json, avatar,
                ),
            )

    def delete_contact(self, number: str) -> None:
        number = self._sanitize_number(number)
        with self._conn() as conn:
            conn.execute("DELETE FROM phonebook WHERE number=?", (number,))

    def get_contact(self, number: str) -> dict[str, Any] | None:
        number = self._sanitize_number(number)
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM phonebook WHERE number=?", (number,)
            ).fetchone()
        if not row:
            return None
        result = dict(row)
        try:
            result["custom_methods"] = json.loads(result.get("custom_methods") or "[]")
        except (TypeError, ValueError):
            result["custom_methods"] = []
        result["brand_logo_url"] = self.get_brand_logo_override(number)
        return result

    def get_all_contacts(self) -> list[dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute("""
                SELECT pb.*,
                    (SELECT 1 FROM muted_numbers mn WHERE mn.number = pb.number) as is_muted,
                    (SELECT 1 FROM pinned_numbers pn WHERE pn.number = pb.number) as is_pinned,
                    (SELECT source_url FROM brand_logo_overrides blo
                     WHERE blo.number = pb.number) as brand_logo_url
                FROM phonebook pb
                ORDER BY pb.name COLLATE NOCASE
            """).fetchall()
        result = []
        for row in rows:
            item = dict(row)
            try:
                item["custom_methods"] = json.loads(item.get("custom_methods") or "[]")
            except (TypeError, ValueError):
                item["custom_methods"] = []
            result.append(item)
        for r in result:
            r["is_muted"] = bool(r["is_muted"])
            r["is_pinned"] = bool(r["is_pinned"])
        return result
