-- Remove legacy admin grants from the default learner role.
-- AdminAccess also ignores USER grants while deployments roll forward.
DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE name = 'USER');
