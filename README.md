# ChangeGuard Web

[ChangeGuard](https://github.com/kyfd/changeguard) 的 Vue 控制台，不是独立后端。主要用于查看变更、检查结果和待办，以及执行审批、管理设置。接口走后端，构建产物是静态页面。

这套控制台尚未提供完整的新建变更、运行检查和签发通行证操作界面；完整操作流程请使用主仓库的内嵌页面。API 客户端中存在对应方法，不代表 Vue 页面已实现这些操作。变更助手为可选功能，依赖后端配置，回答不代替检查或审批。

登录后默认进入工作台。`COMPLETED` 表示通行证已被消费，不代表部署成功；消费占比仅计算当前已加载变更。月度趋势来自独立后端接口，采用其月度统计口径。

## 页面

| 路由 | 做什么 |
| --- | --- |
| `/panorama` | 变更全景：阶段分布、风险、服务和规则命中；点选阶段查看变更 |
| `/dashboard` | 工作台 |
| `/changes` | 变更列表 |
| `/changes/:id` | 变更详情、检查结果、处理时间线、可选助手 |
| `/approvals` | 审批 |
| `/risks` | 风险项 |
| `/policies` | 规则 |
| `/apps` | 服务列表 |
| `/audits` | 审计 |
| `/settings` | 设置 |

路由是 hash 模式，丢到任意静态目录就能开。

全景页使用独立深色样式，不改变其它页面的主题。显示的是最近一次读取的工作区快照，可手动刷新，不是实时服务拓扑。流程数字表示变更当前所处阶段，不是累计通过量；服务、规则或审计接口读取失败时会提示数据缺失。手机上按纵向排列，保留各区内容。

## 开发

需要本机先跑 ChangeGuard 后端。页面请求走相对路径 `/api`，退出登录使用 `/auth/logout`；开发时设置 `CG_API`，Vite 会代理两类路径。未设置时不会启用代理。

```bash
npm install
CG_API=http://127.0.0.1:8080 npm run dev
npm run build        # 类型检查 + 打包
npm run preview      # 预览 dist
```

Windows PowerShell：

```powershell
$env:CG_API = 'http://127.0.0.1:8080'
npm.cmd run dev
npm.cmd test
npm.cmd run build
```

共享状态与消费统计测试使用 Node 内置测试器和 TypeScript 类型剥离，需要 Node 22.6+，建议本地和 CI 使用 Node 24。本次验证版本为 Node 24.15.0。

## 部署

```bash
npm run build
```

把 `dist/` 交给 nginx（或其它静态服务器），`/api` 和 `/auth` 都需要反代到 dbguard，否则退出登录不能清除后端会话。后端仓库的 `deploy/nginx.conf` 是内嵌页面的反代示例，并非这套 Vue 静态站点的完整配置；部署时还需配置静态目录与 HTTPS。
