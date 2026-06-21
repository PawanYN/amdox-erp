$dirs = @(
  "src/common/guards",
  "src/common/interceptors",
  "src/common/filters",
  "src/common/pipes",
  "src/common/decorators",
  "src/common/middleware",
  "src/common/dto",
  "src/auth/strategies",
  "src/auth/guards",
  "src/auth/dto",
  "src/finance/gl",
  "src/finance/ap",
  "src/finance/ar",
  "src/finance/fx",
  "src/finance/dto",
  "src/hr/employee",
  "src/hr/leave",
  "src/hr/attendance",
  "src/hr/payroll",
  "src/hr/dto",
  "src/scm/vendor",
  "src/scm/purchase-order",
  "src/scm/inventory",
  "src/scm/goods-receipt",
  "src/scm/dto",
  "src/notification/channels",
  "src/notification/event-listeners",
  "src/audit/gdpr",
  "src/health",
  "test"
)

foreach ($dir in $dirs) {
  $path = New-Item -ItemType Directory -Force -Path "apps/api/$dir"
  $null = New-Item -ItemType File -Force -Path "$($path.FullName)/.gitkeep"
}
