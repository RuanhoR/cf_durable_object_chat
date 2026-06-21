# HauChat - 聊天软件 TODO

## 已完成
- [x] 项目结构搭建
- [x] pnpm 依赖安装 (vue, vue-router, dayjs, @supabase/supabase-js, vite, @vitejs/plugin-vue)
- [x] wrangler.jsonc 配置 (DO SQLite, routes, assets, vars)
- [x] Supabase 客户端集成
- [x] Durable Object SQLite (ChatRoomDO: rooms, room_members, messages 表)
- [x] OAuth 登录流程 (callback → token exchange → user info)
- [x] Vue.js 前端基础架构 (index.html, main.ts, App.vue)
- [x] i18n 支持 (中/英)
- [x] 深色模式 (白灰黑蓝主题)
- [x] QQ PC 风格 UI (侧栏 + 聊天区布局)
- [x] IndexedDB 用户信息缓存

## 待完成
- [x] Worker 使用框架 (ResponseFrame) 重写
- [x] OAuth 登录流程修复 (account.ruanhor.dpdns.org)
- [x] vue-router 路由 (/, /_callback, /login)
- [x] 未登录自动跳转登录页
- [x] 退出登录服务端 token 失效
- [ ] 移动端响应式布局完善
- [ ] 好友系统
- [ ] 消息通知
- [ ] 代码清理
