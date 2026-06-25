$ErrorActionPreference = "Stop"

# Configuration
$ContainerName = "amdox-keycloak"
$Realm = "amdox-erp"
$Client = "amdox-erp-web"
$Kcadm = "/opt/keycloak/bin/kcadm.sh"

Write-Host "Logging into Keycloak Admin CLI..."
docker exec $ContainerName $Kcadm config credentials --server http://localhost:8080 --realm master --user admin --password admin

Write-Host "Creating Realm '$Realm'..."
docker exec $ContainerName $Kcadm create realms -s realm=$Realm -s enabled=true -o

Write-Host "Creating Client '$Client'..."
docker exec $ContainerName $Kcadm create clients -r $Realm -s clientId=$Client -s enabled=true -s publicClient=false -s secret=amdox-secret-123 -s "redirectUris=[\"http://localhost:3000/*\"]" -s standardFlowEnabled=true -s directAccessGrantsEnabled=true

Write-Host "Creating Test User (erp-admin)..."
docker exec $ContainerName $Kcadm create users -r $Realm -s username=erp-admin -s enabled=true
docker exec $ContainerName $Kcadm set-password -r $Realm --username erp-admin --new-password password123

Write-Host "Keycloak setup complete!"
