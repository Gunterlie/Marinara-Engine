#!/usr/bin/env bash
# Installs the newest site-* release of the website repo on a web server (see WEBSITE-REBUILD.md).
#   scripts/demo/pull-site.sh <target> [owner/repo]
# <target> is a symlink (or absent) that the web server serves. Each release unpacks next to it as
# <target>.site-<version>-<sha>; the symlink swaps in one rename. The previous release stays for rollback:
#   ln -sfn <target>.<previous tag> <target>
# Needs curl, jq, tar and sha256sum. Exit 0 also when the newest release is already live.
set -euo pipefail

target=${1:?usage: pull-site.sh <target> [owner/repo]}
target=${target%/}
repo=${2:-Pasta-Devs/Marinara-Website}

if [ -e "$target" ] && [ ! -L "$target" ]; then
  echo "$target is a real directory. Move it away; pull-site.sh manages it as a symlink." >&2
  exit 1
fi

release=$(curl -fsSL "https://api.github.com/repos/$repo/releases?per_page=100" |
  jq -c '[.[] | select(.tag_name | startswith("site-"))] | sort_by(.created_at) | last // empty')
[ -n "$release" ] || { echo "No site-* release in $repo." >&2; exit 1; }
tag=$(jq -r .tag_name <<<"$release")
name="$(basename "$target").$tag"
dir="$(dirname "$target")/$name"
current=$(readlink "$target" || true)

if [ "$current" = "$name" ]; then
  echo "$tag is already live."
  exit 0
fi

asset() { jq -r --arg s "$1" '.assets[] | select(.name | endswith($s)) | .browser_download_url' <<<"$release" | head -n1; }
work=$(mktemp -d "$dir.tmp-XXXXXX")
trap 'rm -rf "$work"' EXIT
tarball=$(asset .tar.gz)
curl -fsSL -o "$work/$(basename "$tarball")" "$tarball"
curl -fsSL -o "$work/$(basename "$tarball").sha256" "$(asset .tar.gz.sha256)"
(cd "$work" && sha256sum -c --strict "$(basename "$tarball").sha256")

mkdir "$work/site"
tar -xzf "$work/$(basename "$tarball")" -C "$work/site"
rm -rf "$dir"
mv "$work/site" "$dir"
ln -sfn "$name" "$target.new"
mv -T "$target.new" "$target"
echo "Live: $tag (previous: ${current:-none})"

# Keep only the live release and the one before it.
for old in "$target".site-*; do
  case "$(basename "$old")" in "$name" | "$current" | *.tmp-*) ;; *) rm -rf "$old" ;; esac
done
