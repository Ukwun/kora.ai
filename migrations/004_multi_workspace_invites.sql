ALTER TABLE memberships ADD COLUMN IF NOT EXISTS invite_token TEXT;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS memberships_active_user_org_idx ON memberships (organization_id, user_id) WHERE user_id IS NOT NULL AND status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS memberships_invite_token_idx ON memberships (invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS memberships_user_active_idx ON memberships (user_id, status);
INSERT INTO memberships (id, organization_id, user_id, email, role, status, joined_at)
SELECT 'mem_' || users.id, users.organization_id, users.id, users.email, users.role, 'active', users.created_at
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM memberships WHERE memberships.organization_id = users.organization_id AND memberships.user_id = users.id AND memberships.status = 'active'
)
ON CONFLICT DO NOTHING;
