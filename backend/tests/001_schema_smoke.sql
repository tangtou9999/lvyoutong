-- PostgreSQL integration smoke tests for the initial schema.
-- Runs inside a transaction and leaves no test records behind.
BEGIN;

INSERT INTO app_users (id, display_name)
VALUES ('00000000-0000-4000-8000-000000000001', 'CI 测试用户');

INSERT INTO places (
  id, kind, name, normalized_name, category, status, moderation_status, created_by_user_id
) VALUES (
  '00000000-0000-4000-8000-000000000002',
  'fixed_shop', 'CI 测试地点', 'ci测试地点', '小吃', 'active', 'approved',
  '00000000-0000-4000-8000-000000000001'
);

INSERT INTO contributions (
  id, user_id, place_id, experienced_at, taste_score, body
) VALUES (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  now(), 5, 'CI schema integration check'
);

INSERT INTO api_idempotency_keys (user_id, idempotency_key, request_hash, contribution_id)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'ci-idempotency-key', repeat('a', 64),
  '00000000-0000-4000-8000-000000000003'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO api_idempotency_keys (user_id, idempotency_key, request_hash)
    VALUES ('00000000-0000-4000-8000-000000000001', 'ci-idempotency-key', repeat('b', 64));
    RAISE EXCEPTION 'duplicate idempotency key was unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO contributions (user_id, place_id, experienced_at, taste_score)
    VALUES (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002', now(), 6
    );
    RAISE EXCEPTION 'out-of-range rating was unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO place_locations (place_id, longitude, latitude, crs, source)
    VALUES ('00000000-0000-4000-8000-000000000002', 181, 30, 'GCJ02', 'ci');
    RAISE EXCEPTION 'out-of-range longitude was unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;

DO $$
DECLARE visible_count integer;
BEGIN
  SELECT COUNT(*) INTO visible_count
  FROM places
  WHERE status = 'active' AND moderation_status = 'approved';
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one approved active place, got %', visible_count;
  END IF;
END $$;

ROLLBACK;
