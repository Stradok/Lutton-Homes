#!/usr/bin/env bash
# Task 6 channel pack. Every channel file in Docs/channels/ has the five canonical sections, each with its
# exact value as the first non-blank line, in the order Name, Address, Description, Link to website, WhatsApp.
# Every channel file has an Ownership section saying Luton Homes owns the account (NF-08). Every PLACEHOLDER
# carries a parenthesised note. The catalogue names the five sub-brands in full (BR-03) and has at least 10
# placeholders. The Instagram bio line is at most 150 characters. The brand brief carries the canonical
# description, address and catalogue link.
# Optional overrides (used by the mutation check only): CHANNELS_DIR (default Docs/channels) and
# BRAND_BRIEF (default Docs/brand/brand-brief.md). Prints nothing on success, one line per failed
# assertion otherwise, exits 1 on any failure. Needs no Docker.
cd "$(dirname "$0")/../.." || exit 1
shopt -s nullglob
export LC_ALL=C.UTF-8
channels_dir="${CHANNELS_DIR:-Docs/channels}"
brand_brief="${BRAND_BRIEF:-Docs/brand/brand-brief.md}"
fail=0
report() { echo "t6-channels: $1"; fail=1; }

name='Luton Homes'
address='34 Beaconsfield, Luton LU2 0RW'
wa='https://wa.me/c/447934586612'
desc='Short-stay homes near Luton Airport. Five properties, one team. Book direct with Luton Homes.'
website='PLACEHOLDER (domain pending)'
channel_files=(whatsapp-catalogue.md facebook.md instagram.md google-business.md)
headings=(Name Address Description 'Link to website' WhatsApp)
expected=("$name" "$address" "$desc" "$website" "$wa")
subbrands=('EasyStay by Luton Homes' 'Luton Lodge by Luton Homes' 'EasyStay Studio by Luton Homes' 'The Garden Studio by Luton Homes' 'The Garden Nest by Luton Homes')

# Prints the first non-blank line under "## $2" in file $1. Prints nothing if the heading is missing.
first_line_under() {
  awk -v h="## $2" '
    $0 == h { found = 1; next }
    found && /^## / { exit }
    found && /[^[:space:]]/ { print; exit }
  ' "$1"
}
# Prints the whole body under "## $2" in file $1, up to the next "## " heading.
section_body() {
  awk -v h="## $2" '
    $0 == h { found = 1; next }
    found && /^## / { exit }
    found { print }
  ' "$1"
}
# Prints the line number of the first "## $2" heading in file $1.
heading_line() { grep -nxF -- "## $2" "$1" | head -n 1 | cut -d: -f1; }

# Brand brief exists and carries the canonical description, address and catalogue link.
if [ ! -f "$brand_brief" ]; then
  report "$brand_brief is missing"
else
  for s in "$desc" "$address" "$wa"; do
    grep -qF -- "$s" "$brand_brief" || report "$brand_brief is missing \"$s\""
  done
fi

# Exactly the four expected channel files.
files=("$channels_dir"/*.md)
[ ${#files[@]} -eq 4 ] || report "$channels_dir should contain exactly 4 .md files, found ${#files[@]}"
for f in "${channel_files[@]}"; do
  [ -f "$channels_dir/$f" ] || report "$channels_dir/$f is missing"
done

for f in "${files[@]}"; do
  # Each section's first non-blank line is the canonical value, and the headings come in order.
  prev=0
  for i in "${!headings[@]}"; do
    h=${headings[$i]}
    ln=$(heading_line "$f" "$h")
    if [ -z "$ln" ]; then
      report "$f is missing the heading \"## $h\""
      continue
    fi
    got=$(first_line_under "$f" "$h")
    [ "$got" = "${expected[$i]}" ] || report "$f: the line under \"## $h\" is \"$got\", expected \"${expected[$i]}\""
    if [ "$ln" -le "$prev" ]; then
      report "$f: \"## $h\" is out of order (Name, Address, Description, Link to website, WhatsApp)"
    fi
    prev=$ln
  done

  # Ownership: Luton Homes owns the account, the developer is a user only (NF-08).
  if [ -z "$(heading_line "$f" Ownership)" ]; then
    report "$f is missing the heading \"## Ownership\""
  elif ! section_body "$f" Ownership | grep -qF -- 'Luton Homes owns'; then
    report "$f: the \"## Ownership\" section does not say \"Luton Homes owns\""
  fi

  # Every placeholder has a parenthesised note, for example "PLACEHOLDER (domain pending)".
  while IFS= read -r hit; do
    report "$f line ${hit%%:*}: PLACEHOLDER without a parenthesised note"
  done < <(grep -nP 'PLACEHOLDER(?! \()' "$f")
done

catalogue="$channels_dir/whatsapp-catalogue.md"
if [ -f "$catalogue" ]; then
  for p in "${subbrands[@]}"; do
    grep -qF -- "$p" "$catalogue" || report "$catalogue is missing the sub-brand name \"$p\""
  done
  n=$(grep -o -- 'PLACEHOLDER' "$catalogue" | wc -l | tr -d ' ')
  [ "$n" -ge 10 ] || report "$catalogue has $n PLACEHOLDER occurrences; expected at least 10"
fi

# Instagram: the five sub-brand names in full, or the note that the platform limits Highlight name length.
ig="$channels_dir/instagram.md"
if [ -f "$ig" ]; then
  all_subbrands=1
  for p in "${subbrands[@]}"; do
    grep -qF -- "$p" "$ig" || all_subbrands=0
  done
  if [ $all_subbrands -eq 0 ] && ! grep -qF -- "check the platform's limit" "$ig"; then
    report "$ig has neither the five sub-brand names nor the note on the platform's Highlight name limit"
  fi
fi

# The line under "## Bio" that carries the description must fit an Instagram bio (150 characters).
bio_file="$channels_dir/instagram.md"
if [ -f "$bio_file" ]; then
  in_bio=0
  bio_line=""
  while IFS= read -r line; do
    case "$line" in
      "## Bio") in_bio=1 ;;
      "## "*) in_bio=0 ;;
      *)
        if [ $in_bio -eq 1 ] && [[ "$line" == *"$desc"* ]]; then
          bio_line="$line"
          break
        fi
        ;;
    esac
  done < "$bio_file"
  if [ -z "$bio_line" ]; then
    report "$bio_file has no line under \"## Bio\" containing \"$desc\""
  elif [ ${#bio_line} -gt 150 ]; then
    report "$bio_file bio line is ${#bio_line} characters; the limit is 150"
  fi
fi

exit $fail
