-- Give both Healthcare Appts store names the same popup description.
-- Safe to rerun. Does nothing when only one of the names exists.
-- Prefer the "&" row when both already have text. Fill a blank "&" row from "and".

BEGIN;

UPDATE tools AS target
SET description = source.description,
    updated_at = NOW()
FROM tools AS source
WHERE target.name = 'Healthcare Appts and History'
  AND source.name = 'Healthcare Appts & History'
  AND source.description IS NOT NULL
  AND btrim(source.description) <> ''
  AND target.description IS DISTINCT FROM source.description;

UPDATE tools AS target
SET description = source.description,
    updated_at = NOW()
FROM tools AS source
WHERE target.name = 'Healthcare Appts & History'
  AND source.name = 'Healthcare Appts and History'
  AND source.description IS NOT NULL
  AND btrim(source.description) <> ''
  AND (target.description IS NULL OR btrim(target.description) = '');

COMMIT;
