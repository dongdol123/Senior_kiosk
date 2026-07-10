/**
 * PM2 설정 — EC2 프로덕션 (Express API + Next.js)
 *
 * 사전: npm run build && .env 설정
 * 시작: npm run pm2:start
 */
module.exports = {
  apps: [
    {
      name: "senior-kiosk-api",
      cwd: __dirname,
      script: "./server/index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        EXPRESS_PORT: 3001,
      },
    },
    {
      name: "senior-kiosk-web",
      cwd: __dirname,
      script: "npm",
      args: "run start -- -H 0.0.0.0 -p 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
