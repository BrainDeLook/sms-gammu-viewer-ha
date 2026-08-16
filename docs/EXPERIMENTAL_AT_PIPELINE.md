# Experimental AT/SMS pipeline

This document describes the work isolated on the
`experiment/at-sms-pipeline` branch. Stable releases remain on `main`.

## What normal modem clients do

The receive sequence documented by Gammu SMSD is broadly:

1. Enumerate physical records with `GSM_GetNextSMS`/`GetNextSMS`.
2. Link concatenated parts using their UDH reference, total-parts count and
   part sequence (`GSM_LinkSMS`/`gammu.LinkSMS`).
3. Keep an incomplete multipart group in modem storage and wait for the
   missing parts.
4. Persist the complete logical message.
5. Delete the exact physical storage locations only after persistence.

ModemManager follows the same general model: it groups parts using sender plus
the concatenation reference and expected part count, orders them by the UDH
sequence number, and tracks the storage/index of every physical part.

Inspection of Gammu's `GSM_LinkSMS` implementation found an important edge
case. For normal incoming concatenated SMS it matches the UDH 8/16-bit ID,
total, next sequence, SMSC and sender, but does not add a time/generation key.
An 8-bit reference reused by the same sender while old records are present can
therefore select the first matching record from another message. An incomplete
sequence is also returned to the caller instead of being withheld.

For calls, ETSI TS 27.007 defines `+CLCC: <idx>,<dir>,<stat>,...`. The call
index is assigned by the modem and is not always `1`; statuses include active
(`0`), dialing (`2`), alerting (`3`), incoming (`4`) and waiting (`5`).

References:

- [Gammu SMSD receive workflow](https://docs.gammu.org/smsd/code.html)
- [Gammu manual](https://docs.gammu.org/gammu.pdf)
- [ETSI TS 27.005 — SMS AT commands](https://www.etsi.org/deliver/etsi_ts/127000_127099/127005/15.00.00_60/ts_127005v150000p.pdf)
- [ETSI TS 27.007 — call-control AT commands](https://www.etsi.org/deliver/etsi_ts/127000_127099/127007/08.14.00_60/ts_127007v081400p.pdf)
- [ModemManager source](https://github.com/linux-mobile-broadband/ModemManager)

## Root causes in the stable integration

- `sms-gammu-gateway` already calls `gammu.LinkSMS`. The old integration
  treated each returned logical item as a physical part and concatenated all
  items with the same sender. Two ordinary messages from one sender could
  therefore be mixed together or appear in the wrong order.
- A second two-minute "append recent text" heuristic could merge another
  independent SMS into the previous database row.
- `GET /sms` followed by `DELETE /sms/deleteall` was a read/delete race. A new
  message arriving between those requests could be deleted without ever being
  stored.
- Retrying `SendSMS` after an HTTP timeout is not idempotent. The modem may
  have accepted the first send even if the HTTP response was lost, making the
  retry a duplicate.
- Call polling searched for literal `+CLCC: 1,0,3` and `+CLCC: 1,0,0`, so a
  modem using any other call index was interpreted incorrectly.

## Experimental behavior

- Gateway list items are never concatenated or reordered.
- A snapshot with explicit completeness metadata is consumed only when every
  message is complete. Without metadata, the integration requires repeated
  identical snapshots and a final confirmation.
- `/sms/getsms` atomically returns the first linked SMS and deletes its exact
  Gammu `Locations`. `deleteall` is no longer part of incoming collection.
- All REST operations for one gateway are serialized because the add-on owns
  one Gammu state machine/serial control channel.
- An outgoing SMS is attempted once. A timeout is reported as a failure with
  unknown modem outcome and is deliberately not retried.
- `+CLCC` is parsed structurally and supports arbitrary call indices and
  multiple simultaneous call records.

The repository also contains a conservative raw-part assembler prototype in
`raw_sms_pipeline.py`. It orders by UDH sequence, requires every part from
`1..N`, separates reference reuse outside a time window, and quarantines a
cluster with duplicate sequence numbers instead of guessing a pairing. It is
not connected to the current gateway API yet because that API exposes only the
result after `gammu.LinkSMS`.

## Known gateway limitation

PavelVe's add-on computes `Complete`, `PartsReceived` and `PartsExpected` in
`support.py`, but its Flask-RESTX `sms_response` model currently declares only
`Date`, `Number`, `State` and `Text`. `marshal_list_with`/`marshal_with` strips
the completeness fields from both `/sms` and `/sms/getsms`.

Until the add-on exposes those fields and refuses to pop an incomplete group,
the integration has to use the identical-snapshot fallback. That reduces the
risk but cannot mathematically prove completeness: a missing radio part can
arrive after any finite timeout. The standards-based final fix therefore has
three parts:

1. Add a raw-parts endpoint before `gammu.LinkSMS`, including sender, SMSC,
   UDH reference width/value, sequence, total, timestamp and storage location.
2. Assemble only a unique complete `1..N` set and quarantine reference
   collisions instead of returning a guessed message.
3. Delete only the exact locations of an assembly after Home Assistant has
   persisted it.

## Test protocol

Keep SMS monitoring, automatic read-message deletion, call monitoring and
MQTT consumption disabled in the add-on so there is only one consumer.

1. Send two short SMS from the same number within a few seconds. They must be
   two chat rows in the original order.
2. Send two identical SMS from the same number. Neither may be concatenated.
3. Send Cyrillic multipart texts of 2, 3 and 5 parts under both good and weak
   signal conditions. Compare the received text byte-for-byte with the source.
4. Send a second short SMS while the first snapshot is being consumed. It
   must remain on the modem and appear in the next collection pass.
5. Cause an HTTP timeout during sending. Verify that only one modem submission
   occurs and the integration does not retry automatically.
6. Place calls on a modem that reports a CLCC index other than `1`; verify
   dialing, alerting and active state detection.

Run local pure tests with:

```console
python -m unittest discover -s tests -v
```
