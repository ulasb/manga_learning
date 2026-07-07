#!/usr/bin/env bash
#
# Back up / restore your local library data (backend/data: the SQLite DB, cover
# and page images, and the PDF drop folder). This content is intentionally NOT
# in git, so use this to move your library between your own machines by hand.
#
#   ./scripts/data.sh backup [dest.tar.gz]     # archive backend/data
#   ./scripts/data.sh restore <archive.tar.gz> # restore backend/data
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"
DATA_DIR="$BACKEND_DIR/data"

cmd="${1:-}"
case "$cmd" in
  backup)
    if [ ! -d "$DATA_DIR" ]; then
      echo "No backend/data directory to back up." >&2
      exit 1
    fi
    dest="${2:-manga_data_backup_$(date +%Y%m%d_%H%M%S).tar.gz}"
    tar -czf "$dest" -C "$BACKEND_DIR" data
    echo "Backed up backend/data -> $dest"
    echo "Size: $(du -h "$dest" | cut -f1)"
    ;;
  restore)
    archive="${2:-}"
    if [ -z "$archive" ] || [ ! -f "$archive" ]; then
      echo "usage: $0 restore <archive.tar.gz>" >&2
      exit 1
    fi
    if [ -d "$DATA_DIR" ]; then
      echo "Warning: backend/data already exists; its contents may be overwritten."
      printf "Continue? [y/N] "
      read -r ans
      [ "$ans" = "y" ] || [ "$ans" = "Y" ] || { echo "Aborted."; exit 1; }
    fi
    tar -xzf "$archive" -C "$BACKEND_DIR"
    echo "Restored backend/data from $archive"
    ;;
  *)
    echo "usage: $0 {backup [dest.tar.gz] | restore <archive.tar.gz>}" >&2
    exit 1
    ;;
esac
