# 证据：`app://bundle` 与本地媒体 scheme（#33）

## 为什么需要这份证据

`#33` 的核心修复是**关掉四个窗口的 `webSecurity: false`**。这条改动没法靠单元测试自证：
真正的判据是"在真实 Electron 里，跨源页面还能不能摸到本窗口的 `contextBridge`"，以及
"关掉之后用户自选的背景图/视频还能不能显示"。所以这里留一个可重跑的宿主级探针。

## 怎么跑

需要 `apps/desktop/dist/` 已构建（`npx vite build`）。在仓库根目录：

```bash
env -u ELECTRON_RUN_AS_NODE node_modules/electron/dist/electron.exe \
  --disable-gpu --no-sandbox --disable-software-rasterizer \
  .tinadec_dev/evidence/2026-10-08-issue33-app-bundle-security/app-bundle-smoke.cjs
```

- `ELECTRON_RUN_AS_NODE` 必须去掉，否则 `require('electron')` 只返回一个路径字符串
  （`main.cjs` 顶部就是为这个场景写的兜底提示）。
- `--disable-gpu` 仅是无 GPU 环境需要；有显卡的机器上不加也能跑。

## 读数（`smoke-output.txt`）

```
SMOKE_PAGE  href=app://bundle/index.html origin=app://bundle protocol=app: isSecureContext=true
            mounted=app-mounted entry=["app://bundle/assets/index-BtBDLOB1.js"]
            bridge=object bridgeTerminal=function
SMOKE_MEDIA media=loaded:1x1  file=refused
SMOKE_TRAVERSAL status-404
SMOKE_CROSS_ORIGIN_BRIDGE BLOCKED:SecurityError
```

逐条对应：

| 读数 | 说明 |
| --- | --- |
| `origin=app://bundle` / `isSecureContext=true` / `mounted=app-mounted` | 打包态渲染层真的从自有 origin 加载，Vue 应用挂载成功，入口脚本与 CSS 都解析到 `app://bundle/assets/...` |
| `bridge=object bridgeTerminal=function` | 同源策略开启后 `contextBridge` 依然可用，终端面板等功能不受影响 |
| `media=loaded:1x1` | 用户本地图片经 `tinadec-media://` 正常加载 —— 背景功能没有因为关掉 `webSecurity` 而失效 |
| `file=refused` | 同一个文件的 `file:///` 地址被拒 —— 证明媒体 scheme 是**载荷所在**，不是可有可无的装饰 |
| `status-404` | `app://bundle/../package.json` 被路径穿越防护挡下 |
| `BLOCKED:SecurityError` | **`#33` 攻击链的第一跳已断**：异源 iframe 连读 `parent.tinadec` 都抛 SecurityError。修复前 `webSecurity:false` 下这一步是可读的 |

## 边界

- 探针覆盖的是"渲染层加载 + 跨源可达性 + 本地媒体可达性"三件事，**不是**完整的打包/安装验收。
  打包产物（NSIS/AppImage）本轮未重新构建（见报告"未取证"一节）。
- 跨源探针用的是 `http://127.0.0.1:<随机端口>`，与预览面板里用户自己打开的远程站点等价：
  都是与宿主不同源的文档。
