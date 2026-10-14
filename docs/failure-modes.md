# Failure Modes

| Failure | Behavior | Proving test |
| --- | --- | --- |
| Bad signature | Return 401 and write no row. | `tests/integration/webhook.test.ts` bad signature |
| Tampered body | Raw-byte HMAC fails with 401. | `tests/unit/verifySignature.test.ts` tampered body |
| Duplicate delivery | Return 200 with `duplicate: true`; keep one row. | `tests/integration/webhook.test.ts` deduplication |
| Concurrent duplicates | PostgreSQL conflict handling keeps one row without errors. | `tests/integration/webhook.test.ts` concurrent delivery |
| DB down | Return 500 with `persist failed`; do not crash the process. | Planned DB failure integration case |
| Invalid JSON | Verify signature first, then return 400 without writing. | `tests/integration/webhook.test.ts` malformed JSON |
| Oversized payload | Raw parser rejects payloads over 1 MiB with 413. | `tests/integration/webhook.test.ts` oversized payload |
| Unknown event | Return 200 with `ignored: true`; write no row. | `tests/integration/webhook.test.ts` unknown event |
