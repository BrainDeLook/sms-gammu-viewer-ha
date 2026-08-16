# Experimental raw SMS gateway contract

The `experiment/raw-udh-assembler` integration branch probes this API once.
On a `404` it permanently falls back to the linked compatibility pipeline for
the lifetime of the Home Assistant config entry.

## Read physical parts

`GET /sms/raw` returns modem records before `gammu.LinkSMS`:

```json
[
  {
    "Date": "2026-08-16 12:00:00+03:00",
    "Number": "+70000000000",
    "SMSC": "+79990000000",
    "State": "UnRead",
    "Text": "decoded fragment",
    "Location": 17,
    "Reference": 42,
    "ReferenceBits": 8,
    "PartNumber": 2,
    "PartsExpected": 3,
    "Fingerprint": "sha256..."
  }
]
```

For a standalone SMS, `Reference` and `ReferenceBits` are `null`, while
`PartNumber` and `PartsExpected` are `1`.

The fingerprint covers every returned field except `Fingerprint`. It binds an
acknowledgement to the physical record observed at that location.

## Acknowledge persisted parts

Only after the complete logical SMS exists in SQLite, the integration sends:

`POST /sms/raw/ack`

```json
{
  "Parts": [
    {"Location": 12, "Fingerprint": "sha256-part-1"},
    {"Location": 17, "Fingerprint": "sha256-part-2"}
  ]
}
```

Before deleting, the gateway reads the modem again and recomputes each
fingerprint. A location is deleted only when it still contains the exact same
record:

```json
{
  "Deleted": [12, 17],
  "Mismatched": []
}
```

A changed, missing or duplicated location appears in `Mismatched` and is not
deleted. If Home Assistant crashes after the SQLite commit but before the ACK,
the next poll finds the existing database row and safely retries the ACK.
