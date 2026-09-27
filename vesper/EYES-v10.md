# Vesper · 第 10 轮眼眶结构

本轮修正第 9 轮的结构问题：旧眼睛是凸出的球面，上面再覆一块独立黄色眼皮，轮廓与额头分离。现在删除完整眼球球体和独立黄色盖片，在身体蒙皮网格上雕出浅眼眶，眼皮直接从额头和眼周皮肤延伸；绿色眼面放在这层皮肤之内。

表情继续以用户提供的伤心照片为参考：内眼角上扬、外眼角低垂，黑瞳下视，嘴线中央较平、两角向下。身体总体比例、浅奶黄色软胶材质、教堂和玩法沿用。

## 实际结构

- 眼周使用两轮局部共边细分，相邻三角形共用细分点，无独立补片接缝。身体网格从 194,362 增至 260,413 顶点；仅头部前侧增加密度。
- 上眼皮是身体网格的浅眼眶上缘，与额头共用拓扑、顶点颜色、物理材质和 Head 骨骼权重，不再存在 Golden eyelid skin 或黄色眼皮 Mesh。
- 眼面依头部曲面坐标生成浅弧面，相对原解析脸面沿前后轴内退 2.5–6.5 毫米；瞳孔贴合眼面，前移仅 0.35 毫米。眼球不再从头部轮廓鼓出。
- 眨眼移动同一皮肤表面的眼眶上界，闭合时皮肤覆盖绿眼和黑瞳，只保留浅褶。眨眼结束精确恢复默认位置及法线。
- 眨眼所需的静态曲面采样在初始化时缓存；每帧只计算变化部分与局部法线，不重算法线或重建全身网格。

## 同条件截图

| 视角 | 第 9 轮 | 第 10 轮 |
| --- | --- | --- |
| 正面 | [之前](assets/eye-integration/baseline/front.jpg) | [现在](assets/eye-integration/refined/front.jpg) |
| 四分之三 | [之前](assets/eye-integration/baseline/quarter.jpg) | [现在](assets/eye-integration/refined/quarter.jpg) |
| 侧面 | [之前](assets/eye-integration/baseline/side.jpg) | [现在](assets/eye-integration/refined/side.jpg) |
| 闭眼 | [之前](assets/eye-integration/baseline/closed.jpg) | [现在](assets/eye-integration/refined/closed.jpg) |

[教堂内近景](assets/eye-integration/final/church-skin.jpg) · [当前模型查看](../vesper.html?model=1&revision=10&inspect=1)。这些均为真实 Three.js 几何渲染。

## 文件与验证

- character.js：一体化眼眶、内嵌眼面、同网格眨眼及采样缓存。
- sculpt-union.js：局部共边细分工具，保留拓扑连接、法线、颜色、UV 与骨骼权重。
- eye-study.cjs：固定相机的正面、侧面、四分之三、闭眼和恢复检查。
- assets/nailong.glb、当前静帧与行走演示：同步新结构。保留 15 根骨骼与 Idle / Walk；程序化眨眼仍由网页控制，独立 GLB 包含新的默认表情。

[实际蒙皮检查](assets/eye-integration/check/check.json)：对真正蒙皮后的前脸进行射线遮挡检查，闭眼绿眼与瞳孔采样全部被身体皮肤覆盖；睁眼后恢复位置、法线；行走时五官随 Head 正常运动。检查同时记录 CPU 开销、材质和源码摘要。

character-review 的有限顶点、动画与脚底检查通过。本轮未改变服务器或教堂资源，也没有提交、推送或部署。
最终验证：闭眼260个采样全部遮挡，最小前向覆盖约1.49毫米；位置和法线恢复误差均为0。预计算后，90次活跃眨眼CPU耗时中位2.7ms、最大3.2ms（不含渲染，开发机测量），原版本中位51.5ms。GLB检查确认6网格、15骨骼、无独立黄色眼皮材质，Idle/Walk各节点轨道与第9轮字节一致。最终视频为1280×800、30fps、7.97秒，WebM和MP4全帧解码通过。
