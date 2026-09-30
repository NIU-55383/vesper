# Vesper · 3D 资产与 Blender 编辑

这些资产由 `character.js` / `church.js` 的真实 Three.js 网格生成并导出为 GLB。不是贴图冒充的三维场景，也不是在 Blender 中制作后导出的模型。随附脚本用于把模型交接到 Blender 继续修改；当前开发环境没有 Blender，因此**尚未执行 Blender 导入、保存或离线渲染验证**。

## 文件

| 文件 | 内容 |
| --- | --- |
| `assets/nailong.glb` | 奶龙独立角色；全身连续蒙皮梨形身体、圆顶头部、薄唇、小型近圆绿色眼睛、微垂眼睑与渐变深色手足及命名骨骼；`Idle` / `Walk` 动画。 |
| `assets/church.glb` | 第一章教堂建筑、Stall B 座位、帘幕、档案侧室、票据机、上层维护区、19:31 大钟及灰紫长廊；可导出的材质、贴图及灯光。 |
| `assets/chapter-one-opening.jpg` / `assets/chapter-one-initial-light.jpg` / `assets/chapter-one-sanctuary.jpg` | 本轮同步的高画质 WebGL 黑底顶光开场、初始紫光与开帘后教堂预览。 |
| `import_into_blender.py` | Blender 4.2+ 的导入、相机、场景保存与可选静帧渲染脚本。 |

角色模型的来源是程序化建模。当前第 7 版在第 6 版的白底托肚参考基础上，放缓头颈过渡、内收肘部、缩短腹斑下缘，改为拇指加三根粗短手指，压低并前伸脚掌，降低眼部厚度和高光。详见 [修改参数与验收](REMODEL-v7.md) 和 [四向前后对照](review.html)。参考图仅供本机建模对照，没有作为游戏素材发布；未使用下载的第三方模型。教堂是参考照片的艺术化重构，建筑来源与差异见 architecture-notes.md。

## 直接导入

Blender 中选择 **File → Import → glTF 2.0 (.glb/.gltf)**，分别导入需要的 GLB。导入器会保留模型层级、蒙皮和 glTF 动画；动画可在 Action Editor / NLA Editor 中查看。角色的动作包含多个节点的轨道，编辑时应保留同名片段的各个节点轨道。

模型单位是米。Three.js / glTF 的 `X,Y,Z` 由 Blender 自动转换成 `X,-Z,Y`：Y 轴高度变成 Blender 的 Z 轴高度，原 +Z 朝向变成 Blender 的 -Y。**无需再手动旋转 90°**。独立角色约 2.00 米高，原点在脚底。

## 一键建立编辑场景

以下 PowerShell 示例在仓库根目录运行；将 `blender` 换成本机 Blender 可执行文件的完整路径即可。不需要安装 Python 包。

```powershell
blender --background --python vesper/import_into_blender.py -- --asset both
```

默认输出 `vesper/assets/vesper-both.blend`。脚本新建场景，保留已有的其他场景；同时导入时，把角色放在 Blender `(0, -10, 0)`，朝向祭坛。导入网格和骨骼保持原有变换，新增的 `Nailong placement` 空物体负责世界位置与朝向。

角色单独编辑并生成静帧：

```powershell
blender --background --python vesper/import_into_blender.py -- --asset character --engine cycles --samples 96 --render vesper/assets/nailong-still.png
```

教堂使用楼廊视角并指定输出路径：

```powershell
blender --background --python vesper/import_into_blender.py -- --asset church --camera gallery --output vesper/assets/church-editable.blend
```

在 Blender 的 **Scripting** 工作区打开已保存的 `import_into_blender.py` 并点击 **Run Script**，也可以执行默认的双资产导入。再次运行时，默认拒绝覆盖已有输出；命令行加 `--overwrite` 明确允许覆盖，或使用新的 `--output` 路径。更多参数用 `-- --help` 查看。

## 灯光、动画与效果边界

- 教堂优先沿用 GLB 中的灯光，增加低强度紫灰环境光；GLB 完全没有灯光时才增加侧窗备用面光。独立角色模式添加独立的柔光摄影灯和地面。
- 提供中央过道、楼廊、角色三个相机；静帧默认 1600 × 1000。默认使用 Eevee，`--engine cycles` 可切换 Cycles。两种引擎的材质和灯光外观需要在本机 Blender 中进一步检查。
- `Idle` 与 `Walk` 是可导出的动画片段。游戏中的混合控制、程序化眨眼以及输入驱动的走位属于浏览器运行时逻辑，不会变成 GLB 动画。
- Three.js 雾、后处理、实时尘埃、自定义光束着色器及开场双 Scene 的 HDR 画面混合无法完整存入标准 GLB。黑底顶光开场与教堂的溶解在 bloom 前完成，属于浏览器运行时效果。Blender 中的体积雾和最终调色需要另行设置，不能把脚本导入结果当作与网页逐像素相同的离线渲染。
- 脚本不运行游戏谜题、不修改源代码，也不自动安装或下载 Blender。

实现依据：[Blender glTF 手册](https://docs.blender.org/manual/en/5.0/addons/import_export/scene_gltf2.html)、[导入操作 API](https://docs.blender.org/api/main/bpy.ops.import_scene.html)、[官方导入器坐标转换源码](https://github.com/blender/blender/blob/main/scripts/addons_core/io_scene_gltf2/blender/imp/blender_gltf.py)。

## 当前角色与沿用动画

第 6 版建立小圆头、前伸的薄嘴、喉部曲线与宽厚梨形腹部，第 7 版进一步校正接合与局部比例，奶油色腹斑采用宽拱形轮廓。手臂弯曲搭在腹部两侧，手指与拇指分开建形；双腿从大腿向细踝收束，脚掌有连续足背和三根脚趾。轻微下看的瞳孔、放松的上眼睑与行走时低头表达淡淡忧伤，静态姿势优先保留参考图比例。

角色沿用 15 根骨骼，包括独立肘部和腕部；名称、层级和动画轨道保持兼容。头身、双臂和腿通过隐式表面融合；手掌与脚部独立精细建形后合并到同一可见蒙皮网格，眼睛与薄嘴保留独立表面。腹斑使用连续顶点颜色，手足渐变为深橄榄色。这一角色校形轮次未修改教堂；后续第一章扩展见下方说明。

行走使用 1.10 秒周期，交替支撑约占 58% 周期，摆动脚抬高约 5.2 厘米，髋摆约 -21° 至 +19.5°。扶腹的前臂仅有轻微身体随动，头部合成俯角约 9–11°；待机姿态几乎直立。脚底校准使用最终可见网格的实际顶点。

默认移动速度约 0.80 米/秒，双击 W / ↑ 并按住可加快到 1.7 倍，Shift 保留为辅助操作。摇杆幅度和碰撞后的实际位移决定动画相位；落脚时才播放脚步声。GLB 中的 Walk 为原地循环，应用接入时按 referenceSpeed 同步世界位移。

- node vesper/character-review.cjs：实际几何、动画、脚底高度与三视图；输出 nailong-three-view.jpg、nailong-expression.jpg、nailong-face-profile.jpg、nailong-sculpt.jpg、nailong-walk-poses.jpg。
- node vesper/gait-check.cjs：支撑脚高度、滑步、膝踝轨道、相位、脚步事件及导出片段循环。
- node vesper/record-gait.cjs：真实 WebGL 动画录屏，待机 → 行走 → 停步。演示见 assets/nailong-walk.mp4。

第 7 版正式校形请使用 node vesper/model-study.cjs <新阶段名>；脚本保留旧阶段，固定中性相机与灯光。assets/review-v7/final/ 是本轮正式截图，before-neutral/ 是对应基线。旧 character-review.cjs 的暖色工作图已刷新，但不用于中性颜色对照。


当前资源已同步[第 8 轮皮肤材质](MATERIAL-v8.md)：更浅的奶黄色、柔润软胶反射，以及教堂灰紫色环境融合。形体与骨骼仍为第 7 版；独立 GLB 使用相同基础色和物理材质，教堂环境反射由网页场景提供。

当前角色和动画预览已同步[第 9 轮忧伤表情](EXPRESSION-v9.md)：内高外低的柔和上眼皮、低垂视线、下弯嘴角，沿用第 8 轮材质与第 7 版身体。

最新资源为[第 10 轮一体化眼眶](EYES-v10.md)：上眼皮改为身体同一蒙皮表面，绿色眼面内嵌，替代第 9 轮的独立眼皮盖片；保持 v8 材质和原 Idle / Walk。

## 第一章场景资源同步

第一章导出的 assets/church.glb 包含窗帘、B17/B18、侧室验证器、上层磁带区与出口长廊，以及可表示的材质和灯光。谜题机关由网页状态机驱动，不作为 GLB 动画导出。奶龙网格及 Idle / Walk 沿用第 10 轮资源；本次开场调整没有修改角色网格、骨骼或动画资产。

当前开场在独立黑底场景中保留原竖直顶光、悬浮构图和 160 粒尘埃。首次移动先靠近、落地并对齐镜头与姿态，再整幅渐变进入初始已有 60% 左窗紫光、透光帘缝和原 900 粒随机尘埃的教堂。悬浮、落地、场景混合及后处理均由浏览器运行时控制，不作为 GLB 资源导出。

此前已检查教堂 GLB 的文件头、长度与场景节点，尚未执行 Blender 导入验证。本轮没有重新导出 GLB，沿用此前的教堂结构资产；三张高画质网页预览已同步。开场浏览器专项 13 项通过、页面错误列表为空，报告与过程截图位于 test-results/opening-dissolve/；减弱动态分支仅经代码审查，未作本轮浏览器实测。
