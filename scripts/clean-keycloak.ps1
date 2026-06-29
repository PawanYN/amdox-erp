$ErrorActionPreference = "Stop"

# Configuration
$ContainerName = "amdox-keycloak"
$Kcadm = "/opt/keycloak/bin/kcadm.sh"

Write-Host "Logging into Keycloak Admin CLI..."
docker exec $ContainerName $Kcadm config credentials --server http://localhost:8080 --realm master --user admin --password admin

Write-Host "Fetching all Keycloak realms..."
$RealmsJson = docker exec $ContainerName $Kcadm get realms --fields realm
$Realms = $RealmsJson | ConvertFrom-Json

foreach ($R in $Realms) {
    $RealmName = $R.realm
    if ($RealmName -ne "master") {
        Write-Host "Deleting Realm '$RealmName'..."
        try {
            docker exec $ContainerName $Kcadm delete "realms/$RealmName"
            Write-Host "✅ Deleted '$RealmName'"
        } catch {
            Write-Host "⚠️ Failed to delete realm '$RealmName': $_"
        }
    }
}

Write-Host "Keycloak cleanup complete!"
