/**
 * Production process manager config for the public demo deployment.
 * Prod runs alongside the dev servers on separate ports:
 *   dev api :3001 / dev web :3000  |  prod api :3101 / prod web :3100
 * Caddy (ports 80/443) reverse-proxies the public hostnames to the prod ports.
 */
module.exports = {
  apps: [
    {
      name: 'amdox-api',
      cwd: '/home/ubuntu/amdox-erp/apps/api',
      script: 'dist/main.js',
      node_args: '--enable-source-maps',
      env: {
        NODE_ENV: 'production',
        PORT: '3101',
        FRONTEND_URL: 'https://erp.92-4-86-3.sslip.io',
        KEYCLOAK_BASE_URL: 'https://kc.92-4-86-3.sslip.io',
      },
      max_memory_restart: '1G',
    },
    {
      name: 'amdox-web',
      cwd: '/home/ubuntu/amdox-erp/apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3100',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1G',
    },
  ],
};
