-- Store Resend audience contact IDs to avoid contacts.list() on every sync.
ALTER TABLE users ADD COLUMN IF NOT EXISTS resend_contact_id TEXT;

CREATE INDEX IF NOT EXISTS users_resend_contact_id_idx
  ON users (resend_contact_id)
  WHERE resend_contact_id IS NOT NULL;
