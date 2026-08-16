# ChangeGuard Web · 治理控制台前端

[ChangeGuard](https://github.com/kyfd/changeguard) 企业生产变更风险治理平台的 Vue 3 控制台。

生产环境由 nginx 托管本项目的构建产物（`dist/`），并将 `/api` 反向代理到 dbguard 核心服务。

## 技术栈

- Vue 3 + `<script setup>` + TypeScript
- Vite 6（vendor 分包、相对路径 base，可任意子路径托管）
- Pinia（auth / workspace 状态）
- Vue Router（hash 模式，纯静态托管无需服务端回退）

## 页面

| 路由 | 说明 |
| --- | --- |
| `/panorama` | 治理全景大屏（拓扑卫星、风险光谱、规则雷达） |
| `/dashboard` | 治理概览 |
| `/changes` | 变更工单列表（搜索覆盖 ID/标题/应用/负责人，按更新时间排序，独立错误态与重试） |
| `/changes/:id` | 变更详情（护照五步、确定性规则证据、Clawbot 变更助手、处理时间线） |
| `/approvals` | 审批中心 |
| `/risks` | 风险中心 |
| `/policies` | 治理规则 |
| `/apps` | 纳管服务 |
| `/audits` | 审计日志 |
| `/settings` | 系统设置 |

## 关键设计

- **认证**：same-origin Cookie + CSRF Token + `X-Actor-ID`，登录后由 session 引导
- **容错加载**：`/api/changes` 作为主链路独立加载，dashboard / 审计 / 集成等次要数据失败不阻塞变更列表
- **Clawbot 会话**：接入后端 `agent-conversations` 历史接口，刷新页面可恢复问答，trace 错误可见
- **详情独立加载**：路由直达时走 `GET /api/changes/{id}`，区分 404 / 403 / 网络错误

## 开发

```bash
npm install
npm run dev        # 开发服务器（默认 5173）
npm run build      # vue-tsc 类型检查 + vite 生产构建
npm run build:fast # 跳过类型检查
```

## 部署

```bash
npm run build
# 将 dist/ 发布到服务器静态目录，例如：
# /opt/changeguard/web-releases/web-<version>/
# ln -sfn /opt/changeguard/web-releases/web-<version> /opt/changeguard/web-new
# nginx -t && systemctl reload nginx
```
