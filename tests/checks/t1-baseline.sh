#!/usr/bin/env bash
# Task 1 baseline: ignore rules, README folder map, docs present, no tracked .env.
cd "$(dirname "$0")/../.." || exit 1
fail=0

for line in .env docker/.env .superpowers/; do
  grep -qxF -- "$line" .gitignore 2>/dev/null || { echo "  .gitignore lacks line: $line"; fail=1; }
done

for word in frontend/ backend/; do
  grep -qF -- "$word" README.md 2>/dev/null || { echo "  README.md does not mention: $word"; fail=1; }
done

for doc in Docs/architecture.md Docs/decisions/0001-classic-wordpress.md; do
  [ -f "$doc" ] || { echo "  missing file: $doc"; fail=1; }
done

if git ls-files | grep -qE '(^|/)\.env$'; then
  echo "  a .env file is tracked by git"
  fail=1
fi

exit $fail
