#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${KEYCLOAK_CONTAINER:-amdox-keycloak}"
REALM="${KEYCLOAK_REALM:-amdox-erp}"
CLIENT="${KEYCLOAK_CLIENT:-amdox-erp-web}"
ADMIN_USER="${KEYCLOAK_ADMIN_USERNAME:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
ERP_ADMIN_USER="${ERP_ADMIN_USERNAME:-erp-admin}"
ERP_ADMIN_PASS="${ERP_ADMIN_PASSWORD:-password123}"
ERP_ADMIN_EMAIL="${ERP_ADMIN_EMAIL:-erp-admin@amdox.demo}"
KCADM="/opt/keycloak/bin/kcadm.sh"

echo "Waiting for Keycloak container..."
for i in $(seq 1 90); do
  if curl -sf http://localhost:8180/realms/master >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

docker_cmd() {
  if docker info >/dev/null 2>&1; then
    docker "$@"
  else
    sudo docker "$@"
  fi
}

echo "Logging into Keycloak Admin CLI..."
docker_cmd exec "$CONTAINER_NAME" "$KCADM" config credentials \
  --server http://localhost:8080 \
  --realm master \
  --user "$ADMIN_USER" \
  --password "$ADMIN_PASS"

if docker_cmd exec "$CONTAINER_NAME" "$KCADM" get "realms/$REALM" >/dev/null 2>&1; then
  echo "Realm '$REALM' already exists."
else
  echo "Creating realm '$REALM'..."
  docker_cmd exec "$CONTAINER_NAME" "$KCADM" create realms \
    -s realm="$REALM" \
    -s enabled=true \
    -s displayName="Amdox ERP"
fi

if docker_cmd exec "$CONTAINER_NAME" "$KCADM" get clients -r "$REALM" -q clientId="$CLIENT" | grep -q '"clientId"'; then
  echo "Client '$CLIENT' already exists."
else
  echo "Creating client '$CLIENT'..."
  docker_cmd exec "$CONTAINER_NAME" "$KCADM" create clients -r "$REALM" \
    -s clientId="$CLIENT" \
    -s enabled=true \
    -s publicClient=true \
    -s secret=amdox-secret-123 \
    -s 'redirectUris=["http://localhost:3000/*","http://localhost:3001/*","http://127.0.0.1:3000/*"]' \
    -s standardFlowEnabled=true \
    -s directAccessGrantsEnabled=true \
    -s 'webOrigins=["+"]'
fi

if docker_cmd exec "$CONTAINER_NAME" "$KCADM" get users -r "$REALM" -q username="$ERP_ADMIN_USER" | grep -q '"username"'; then
  echo "User '$ERP_ADMIN_USER' already exists."
else
  echo "Creating user '$ERP_ADMIN_USER'..."
  docker_cmd exec "$CONTAINER_NAME" "$KCADM" create users -r "$REALM" \
    -s username="$ERP_ADMIN_USER" \
    -s email="$ERP_ADMIN_EMAIL" \
    -s enabled=true \
    -s emailVerified=true

  USER_ID=$(docker_cmd exec "$CONTAINER_NAME" "$KCADM" get users -r "$REALM" -q username="$ERP_ADMIN_USER" --fields id --format csv --noquotes | tail -1)
  docker_cmd exec "$CONTAINER_NAME" "$KCADM" set-password -r "$REALM" --userid "$USER_ID" --new-password "$ERP_ADMIN_PASS"
fi

echo "Keycloak setup complete."
echo "  Realm:  $REALM"
echo "  Client: $CLIENT"
echo "  User:   $ERP_ADMIN_USER / $ERP_ADMIN_PASS"
