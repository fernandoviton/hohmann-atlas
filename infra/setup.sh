#!/usr/bin/env bash
# One-time Azure infrastructure setup for Hohmann Atlas
# Prerequisites: az cli logged in, Docker not required (uses ACR build)
set -euo pipefail

# Verify az cli is logged in and show active subscription
if ! SUB_INFO=$(az account show 2>&1); then
  echo "ERROR: Not logged in to Azure. Run 'az login' first." >&2
  exit 1
fi
SUB_NAME=$(echo "$SUB_INFO" | grep -o '"name": "[^"]*"' | head -1 | cut -d'"' -f4)
SUB_ID=$(echo "$SUB_INFO" | grep -o '"id": "[^"]*"' | head -1 | cut -d'"' -f4)
echo "==> Using subscription: $SUB_NAME ($SUB_ID)"
echo ""

# Configuration — edit these as needed
RESOURCE_GROUP="hohmann-atlas-rg"
LOCATION="westus"
ACR_NAME="hohmannatlas"
ENVIRONMENT_NAME="hohmann-atlas-env"
APP_NAME="hohmann-atlas-api"
GH_PAGES_URL="https://$(git remote get-url origin | sed -E 's|.*github.com[:/]([^/]+)/([^/.]+).*|\1.github.io|')"

echo "==> Creating resource group: $RESOURCE_GROUP"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

echo "==> Creating container registry: $ACR_NAME"
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true

echo "==> Building and pushing image via ACR"
az acr build \
  --registry "$ACR_NAME" \
  --image hohmann-atlas-api:latest \
  --file backend/Dockerfile \
  backend/

echo "==> Creating Container Apps environment"
az containerapp env create \
  --name "$ENVIRONMENT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION"

ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

echo "==> Creating Container App: $APP_NAME"
az containerapp create \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$ENVIRONMENT_NAME" \
  --image "${ACR_LOGIN_SERVER}/hohmann-atlas-api:latest" \
  --registry-server "$ACR_LOGIN_SERVER" \
  --registry-username "$ACR_NAME" \
  --registry-password "$ACR_PASSWORD" \
  --target-port 8000 \
  --ingress external \
  --cpu 0.25 \
  --memory 0.5Gi \
  --min-replicas 0 \
  --max-replicas 1 \
  --env-vars "ALLOWED_ORIGINS=$GH_PAGES_URL" \
  --query properties.configuration.ingress.fqdn \
  -o tsv

FQDN=$(az containerapp show \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query properties.configuration.ingress.fqdn \
  -o tsv)

echo ""
echo "==> Deployment complete!"
echo "    API URL: https://$FQDN"
echo ""
echo "Add these GitHub repository secrets:"
echo "  ACR_NAME=$ACR_NAME"
echo "  API_URL=https://$FQDN"
echo "  AZURE_CREDENTIALS: run the following, then pipe through the mapping script:"
echo "    MSYS_NO_PATHCONV=1 az ad sp create-for-rbac --name hohmann-atlas-ci --role contributor --scopes /subscriptions/$SUB_ID/resourceGroups/$RESOURCE_GROUP"
echo "    (if not using Git Bash, omit the MSYS_NO_PATHCONV=1 prefix)"
echo ""
echo "  Then convert the output for azure/login:"
echo "    <above command> | bash infra/map-credentials.sh $SUB_ID"
echo ""
echo "  Paste the final JSON as the AZURE_CREDENTIALS repository secret."
