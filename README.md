# ChangeGuard Web

[ChangeGuard](https://github.com/kyfd/changeguard) 的 Vue 控制台。登录、变更单、审批、规则和审计都走后端 `/api`，这个仓库只出静态页面。

## 页面

| 路由 | 做什么 |
| --- | --- |
| `/panorama` | 总览 |
| `/dashboard` | 工作台 |
| `/changes` | 变更列表 |
| `/changes/:id` | 变更详情、检查结果、通行证 |
| `/approvals` | 审批 |
| `/risks` | 风险项 |
| `/policies` | 规则 |
| `/apps` | 纳管的服务 |
| `/audits` | 审计 |
| `/settings` | 设置 |

路由是 hash 模式，丢到任意静态目录就能开。

## 开发

需要本机先跑 ChangeGuard 后端（默认 `http://localhost:8080`）。页面请求走相对路径 `/api`，开发时把 Vite 反代过去，或用 nginx 一起托管。

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # 类型检查 + 打包
npm run preview      # 预览 dist
```

## 部署

```bash
npm run build
```

把 `dist/` 交给 nginx（或其它静态服务器），`/api` 反代到 dbguard。后端仓库的 `deploy/nginx.conf` 有一份现成配置。
