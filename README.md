# Chirpi 手机网页版

装在手机浏览器里的练球陪伴：摄像头识别挥杆，每杆一分，每 5 杆一句建议，每杆录一段视频。

纯静态页面，没有后端：姿态识别、分析、积分都在手机上跑，视频和资料不离开手机。
还没有 Claude 聊天（需要后端保管 API key）、参考动作对比和回家路上的电话。

- `swing.js`：`core/` 里挥杆识别和分析的 JS 版，`tests/test_mobile_port.py` 保证两边结果一致，改一边就要改另一边。
- `pose.js`：摄像头和 MediaPipe 姿态模型。
- `practice.js`：一次练球的循环和录像。
- `app.js`：页面。
- `vendor/`：`@mediapipe/tasks-vision` 1.2.2（Apache-2.0）。`models/`：官方 pose_landmarker_lite，和 Python 版同一个模型。

## 本地运行

摄像头要求 HTTPS 或 localhost。

```bash
python3 -m http.server 8790 --directory chirpi/mobile
```

## 部署

这个文件夹本身就是网站，放到任何静态托管上都行。
