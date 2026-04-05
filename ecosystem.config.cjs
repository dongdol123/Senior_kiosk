/**
 * PM2 설정 — 프로덕션에서 API(Express)와 웹(Next.js) 동시 실행
 *
 * 사전 작업: npm run build
 * 시작: pm2 start ecosystem.config.cjs
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
      },
      // .env / .env.local 은 server/index.js 에서 로드
    },
    {
      name: "senior-kiosk-web",
      cwd: __dirname,
      script: "npm",
      args: "run start -- -H 0.0.0.0",
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
