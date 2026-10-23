ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT;

CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_thread_members (
  thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id),
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  attachment JSONB,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_threads_org_updated_idx ON chat_threads(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS chat_thread_members_user_idx ON chat_thread_members(organization_id, user_id);
CREATE INDEX IF NOT EXISTS chat_messages_thread_created_idx ON chat_messages(thread_id, created_at ASC);
