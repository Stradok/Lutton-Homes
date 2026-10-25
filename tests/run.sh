#!/usr/bin/env bash
# Runs every tests/checks/*.sh from the repo root, prints PASS or FAIL per check, exits 1 if any failed.
cd "$(dirname "$0")/.." || exit 1
status=0
for check in tests/checks/*.sh; do
  [ -e "$check" ] || continue
  name=$(basename "$check" .sh)
  if bash "$check"; then
    echo "PASS $name"
  else
    echo "FAIL $name"
    status=1
  fi
done
exit $status
