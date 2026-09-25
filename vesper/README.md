# 薄暮礼拜堂 · Vesper

以 Kensington United Reformed Church 的内景照片为建筑参考的第三人称 3D 密室解谜章节。奶龙在阴冷的紫灰色礼拜堂里醒来，需要找回旋律、引导侧窗的光，再打开正门。场景是根据参考照片制作的艺术化重构，不是建筑测绘复原。

## 本地运行

在本独立仓库根目录运行 `npm start`（首次运行先执行 `npm ci`）。浏览器打开 http://127.0.0.1:18760/；`/vesper.html` 也可使用。Render 部署方法见根目录 README.md。本章节使用浏览器渲染的 Three.js 场景；角色、建筑和谜题都在本地运行。

- WASD / 方向键：移动。
- 鼠标拖动：环绕查看。
- E：与附近物件互动。
- J：查看手记。
- Esc：暂停或关闭当前面板。

谜题进度可由页面保存到本机浏览器；清除站点存储会删除本机存档。页面提供的新游戏入口可以重新开始。

## 第一章流程（含答案）

1. 在入口左侧的小桌上阅读守堂人手记。手记明确给出三音旋律 E → G → C（mi → sol → do），以及反光器角度 60°。
2. 在十字架左侧的管风琴上依次弹奏三个音，获得黄铜透镜。
3. 在右侧窗下与反光器互动，安装透镜，然后选择 60°。侧窗的光照向十字架。
4. 查看十字架下的祭坛，取出旧钥匙。
5. 沿中央过道返回入口，用钥匙打开正门。结局明确显示“奶龙胜利 / Nailong wins”。

错误答案可以无限重试；已解决的光线机关不会被再次误操作打乱。透镜安装后保留在场景中，钥匙不会在开门之前丢失。

## 谜题模块接口

`puzzle.mjs` 是独立、无 DOM 依赖的纯 JavaScript 状态机。每个操作返回新的规范状态，不修改传入对象。

- `createState()`：返回版本 1 的初始状态。
- `restoreState(raw)`：接受 JSON 字符串或普通状态对象，只保留已知字段和合法布尔值；拒绝损坏、过大、不兼容的存档；把缺失前置步骤的进度降到可恢复阶段。
- `interact(state, id)`：`id` 为 `journal`、`organ`、`mirror`（或 `reflector`）、`altar`、`exit`。
- `playNotes(state, notes)`：提交完整的三音数组，例如 `['E', 'G', 'C']`。
- `alignMirror(state, angle)`：提交数值 `30`、`60` 或 `90`。
- `getObjective(state)`、`getHint(state)`：返回适合 HUD 的中文字符串。
- `getInventory(state)`：返回 `{ id, name, description }[]`。
- `getJournal(state)`：返回 `{ title, text }[]`。

操作结果的共同字段为 `{ state, kind, title, text, changed }`。`kind` 是 `notice`、`journal`、`organ`、`mirror`、`success` 或 `win`。`organ` 和 `mirror` 结果提供 `choices: [{ value, label }]`，提交结果可带 `solved`，获得物品时带 `item`。

状态字段：`version`、`journalRead`、`organSolved`、`lensInstalled`、`mirrorAngle`（`null` 或合法角度）、`beamAligned`、`keyTaken`、`escaped`。前置顺序是手记 → 风琴 → 安装透镜 → 60° 对齐 → 取钥匙 → 离开。界面负责位置/距离限制、声音、存储和场景表现；纯状态机负责谜题规则。

`interact(state, 'mirror')` 在持有透镜时自动安装并返回角度选择。已对齐的反光器永久锁定，避免破坏后续进度。存档恢复时不会信任派生的物品列表，背包总是根据规范状态重新计算。

## 验证

在仓库根目录运行：

```powershell
node --test vesper/puzzle.test.mjs
```

测试覆盖完整通关、错误旋律、前置门槛、错误角度后的重试、已解谜状态的幂等性、存档恢复与数据净化、输入不可变性，以及各阶段提示与背包。


## 画面与模型

标题为「晚祷 · 雾中的回声」。可在设置中切换精致、流畅、低功耗画面；声音由右上角按钮主动开启。支持 Shift 快走、滚轮缩放和手机摇杆。模型页为 /vesper.html?model=1。

Three.js 0.180.0 随项目打包，无 CDN 依赖。3D 场景是照片启发的艺术化重构。GLB 与 Blender 导入说明见 ASSETS.md。WebGL 的实时光束、粒子与后期效果不属于标准 GLB 材质。

浏览器回归：node vesper/browser-test.cjs；覆盖路线可达性、实体碰撞、完整解谜、存档、手机边界及共享头像。
