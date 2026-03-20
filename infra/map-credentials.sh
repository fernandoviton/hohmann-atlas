#!/usr/bin/env bash
# Maps az ad sp create-for-rbac output to the format expected by azure/login@v2.
# Usage: az ad sp create-for-rbac ... | bash infra/map-credentials.sh <subscription-id>
set -euo pipefail

SUB_ID="${1:?Usage: ... | bash map-credentials.sh <subscription-id>}"

INPUT=$(cat)

echo "Original output:"
echo "$INPUT"
echo ""

APP_ID=$(echo "$INPUT" | grep -o '"appId": "[^"]*"' | cut -d'"' -f4)
PASSWORD=$(echo "$INPUT" | grep -o '"password": "[^"]*"' | cut -d'"' -f4)
TENANT=$(echo "$INPUT" | grep -o '"tenant": "[^"]*"' | cut -d'"' -f4)

echo "Mapped for AZURE_CREDENTIALS secret:"
cat <<EOF
{
  "clientId": "$APP_ID",
  "clientSecret": "$PASSWORD",
  "tenantId": "$TENANT",
  "subscriptionId": "$SUB_ID"
}
EOF
