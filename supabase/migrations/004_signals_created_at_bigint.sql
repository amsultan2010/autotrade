-- Ensure signals.created_at stores epoch milliseconds (BIGINT) per 001_core_schema.sql.
-- Repairs environments where the column was accidentally created as TIMESTAMPTZ.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'signals'
      AND column_name = 'created_at'
      AND data_type = 'timestamp with time zone'
  ) THEN
    ALTER TABLE signals
      ALTER COLUMN created_at TYPE BIGINT
      USING (EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT;
  END IF;
END $$;
