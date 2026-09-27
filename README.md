# 晚祷 Vesper

独立的第三人称 3D 教堂解谜游戏。奶龙在紫灰色礼拜堂中探索，借助乐音与侧窗的光寻找出口。包含第 7 版角色形体与第 8 轮柔润皮肤材质、Idle / Walk 动画、教堂、谜题、手机摇杆和全部本地资源。

本项目仅维护在 C:/Users/牛特/Documents/GitHub/vesper，对应 GitHub 仓库 NIU-55383/vesper。它可以独立运行、独立部署。

## 本地运行

需要 Node.js 20 或更新版本。在本目录运行：

~~~powershell
npm ci
npm start
~~~

打开 http://127.0.0.1:18760/。旧的 /vesper.html 地址也可使用。模型查看：/vesper.html?model=1&revision=8&inspect=1。

形体前后对照：[四向材质 / 灰模查看](vesper/review.html)。调整参数与验收：[第 7 版记录](vesper/REMODEL-v7.md)。当前颜色、软胶材质与场景融合：[第 8 轮材质记录](vesper/MATERIAL-v8.md)。

服务器读取 PORT 环境变量；未设置时使用 18760。仅在本机预览可设置 LOCAL_ONLY=1。关闭服务器进程或重启电脑后，需要再次运行 npm start。

## 上传 GitHub 并部署到 Render

把本目录的所有项目文件上传到 NIU-55383/vesper 的仓库根目录，保留 vesper/assets 和 vesper/vendor 的目录结构。无需上传 .git、node_modules、test-results 或日志。模型、图片、音视频与 Three.js 库均随仓库一起上传。

在 Render 创建或连接 **这个独立仓库**的 Node Web Service：

| 设置 | 值 |
| --- | --- |
| Root Directory | 留空 |
| Build Command | npm ci |
| Start Command | npm start |
| Health Check Path | /healthz |

也可使用根目录 render.yaml 创建 Blueprint。服务自动使用 Render 提供的 PORT，并默认监听 0.0.0.0。部署完成后，Render 分配的网站域名根路径直接打开游戏。后续上传并提交到这个仓库，由你在 Render 配置的自动部署设置更新。

本次只整理了本地可部署项目，没有提交、推送或创建线上服务。

## 操作与项目文件

WASD / 方向键移动，Shift 快走，拖动鼠标环顾，滚轮缩放，E 互动，J 手记，Esc 暂停。手机使用摇杆和拖动视角。声音通过右上角按钮开启，存档保存在当前浏览器。

- vesper.html：游戏网页入口。
- vesper/：角色、教堂、谜题、模型资产、Three.js 与开发检查脚本。
- avatar-data.js、social-data.js、game-audio.js、game-ui.js、game-ui.css、ui-symbols.svg：本项目自带的界面运行资源，不需要访问另一项目。
- server.js：独立静态资源服务与健康检查。
- vesper/README.md：游戏说明与谜题答案。
- vesper/ASSETS.md：模型和 Blender 导入说明。
- THIRD-PARTY.md：第三方库与参考来源说明。

## 检查

~~~powershell
npm test
npm run test:browser
~~~

第一项检查服务器和谜题状态机。浏览器检查需要开发机可用的 Playwright 与 Chrome；部署本身不需要这些工具。

官方部署说明：https://render.com/docs/deploy-node-express-app
Blueprint 说明：https://render.com/docs/blueprint-spec
