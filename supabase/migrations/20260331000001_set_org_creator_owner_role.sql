-- Set the first member of each organization (by created_at) to "owner" role.
-- This is idempotent: only updates members who are still "member".
-- Better Auth's organization plugin now uses creatorRole: "owner" for new orgs.
UPDATE member SET role = 'owner'
WHERE id IN (
  SELECT DISTINCT ON (organization_id) id
  FROM member
  ORDER BY organization_id, created_at ASC
)
AND role = 'member';
