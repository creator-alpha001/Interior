-- Extensions and functions every later migration depends on.
--
-- This runs before any table is created, because the primary key default on
-- almost every table calls uuid_generate_v7().

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Trigram matching, for catalogue and blog search without a search server.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

--> statement-breakpoint

-- UUIDv7: a time-ordered UUID.
--
-- Postgres only ships uuidv7() from version 18. Until this database is on 18,
-- generate it here. v7 rather than v4 matters because inserts then land at the
-- right-hand edge of the primary key index instead of scattering across it —
-- on the tables that only ever grow (messages, notifications, audit_logs) that
-- is the difference between an index that stays cached and one that does not.
--
-- Layout, per RFC 9562: 48 bits of Unix milliseconds, 4 bits version (7),
-- 12 bits of sub-millisecond precision, 2 bits variant, 62 bits random.
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid
AS $$
DECLARE
  unix_ts_ms  bigint;
  sub_ms      int;
  bytes       bytea;
BEGIN
  unix_ts_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;

  -- Sub-millisecond ordering, so rows written in the same millisecond still
  -- sort by insertion order rather than by their random tail.
  sub_ms := ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000) - unix_ts_ms) * 4096;

  bytes := gen_random_bytes(16);

  -- Bytes 0-5: the timestamp.
  bytes := set_byte(bytes, 0, ((unix_ts_ms >> 40) & 255)::int);
  bytes := set_byte(bytes, 1, ((unix_ts_ms >> 32) & 255)::int);
  bytes := set_byte(bytes, 2, ((unix_ts_ms >> 24) & 255)::int);
  bytes := set_byte(bytes, 3, ((unix_ts_ms >> 16) & 255)::int);
  bytes := set_byte(bytes, 4, ((unix_ts_ms >> 8) & 255)::int);
  bytes := set_byte(bytes, 5, (unix_ts_ms & 255)::int);

  -- Byte 6: version 7 in the high nibble, then sub-millisecond bits.
  bytes := set_byte(bytes, 6, (112 | ((sub_ms >> 8) & 15))::int);
  bytes := set_byte(bytes, 7, (sub_ms & 255)::int);

  -- Byte 8: RFC 4122 variant in the top two bits, random below.
  bytes := set_byte(bytes, 8, ((get_byte(bytes, 8) & 63) | 128)::int);

  RETURN encode(bytes, 'hex')::uuid;
END;
$$ LANGUAGE plpgsql VOLATILE;

--> statement-breakpoint

-- Human-facing reference numbers.
--
-- The frontend generated these by counting rows ("LD-" || count + 1062), which
-- races under concurrency and collides after a delete. Sequences do not.
CREATE SEQUENCE IF NOT EXISTS lead_reference_seq    START WITH 1062;
CREATE SEQUENCE IF NOT EXISTS project_reference_seq START WITH 500;
CREATE SEQUENCE IF NOT EXISTS invoice_reference_seq START WITH 500;
CREATE SEQUENCE IF NOT EXISTS ticket_reference_seq  START WITH 200;
