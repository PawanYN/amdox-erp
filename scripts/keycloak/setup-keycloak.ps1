$ErrorActionPreference = "Stop"

# Configuration
$ContainerName = "amdox-keycloak"
$Realm = "amdox-erp"
$Client = "amdox-erp-web"
$Kcadm = "/opt/keycloak/bin/kcadm.sh"

Write-Host "Logging into Keycloak Admin CLI..."
docker exec $ContainerName $Kcadm config credentials --server http://localhost:8080 --realm master --user admin --password admin

Write-Host "Creating Client '$Client' inside Realm '$Realm'..."
docker exec $ContainerName $Kcadm create clients -r $Realm -s clientId=$Client -s enabled=true -s publicClient=true -s secret=amdox-secret-123 -s 'redirectUris=["http://localhost:3000/*","http://localhost:3001/*"]' -s standardFlowEnabled=true -s directAccessGrantsEnabled=true -s 'webOrigins=["+"]'

Write-Host "Client setup complete!"
