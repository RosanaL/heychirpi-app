# Chirpi 手机网页版

装在手机浏览器里的练球陪伴：摄像头识别挥杆，每杆一分，每 5 杆一句建议，每杆录一段视频。

纯静态页面，没有后端：姿态识别、分析、积分都在手机上跑，视频和资料不离开手机。
还没有 Claude 聊天（需要后端保管 API key）、参考动作对比和回家路上的电话。

- `swing.js`：`core/` 里挥杆识别和分析的 JS 版，`tests/test_mobile_port.py` 保证两边结果一致，改一边就要改另一边。
- `pose.js`：摄像头和 MediaPipe 姿态模型。
- `practice.js`：一次练球的循环和录像。
- `app.js`：页面。
- `onboarding.js`：第一次打开的流程：夜场里的一颗球，聊几句、挑帽子、按住孵出小鸟。
- `talk.js`：练球时点麦克风跟 Chirpi 说话。手机自带的语音识别把话转成文字，发给对话服务器，再一句接一句播放 Chirpi 的回答。服务器地址和邀请码从链接的 `#talk=…&code=…` 读一次，存在这台手机上；没有的话麦克风按钮不出现。对话服务器不在这个仓库里，密钥也不在。
- `realtime.js`：练球时的「实时对话」模式（在「手机放哪儿？」那一页选）。练球一开始就接通 ElevenLabs Agents，可以随时跟 Chirpi 说话；app 把每一杆和每组建议发给它，建议由它用自己的话说出来，这时录好的台词不播。每次最多 10 分钟，到时间或连不上就自动换回录好的声音。agent id 在 `realtime-config.js`，空着就不显示这个选项。
- `fonts/`：小赖字体 SC 的子集（常用 3755 字 + app 里出现的字，约 760 KB），SIL OFL 1.1，许可证在 `fonts/OFL.txt`。现在只有练球页用它，样式照 `design-system` 的「练球中」。改了台词里有生僻字的话，要重新做子集。
- `demo/`：给简历用的实时语音 demo（网址 `/demo/`）：电脑或手机浏览器打开就能和 Chirpi 实时对话，中英文都行。对话由 ElevenLabs Agents 托管（听、判断说完没有、可以插话、用 Claude 回答、用 ElevenLabs 的声音念），页面里只有公开的 agent id，在 `demo/config.js`。和练球页的对话是两套，互不影响。
- `vendor/`：`@elevenlabs/client` 1.35.0（MIT，demo 页和选了实时对话的练球页才加载）；`@mediapipe/tasks-vision` 1.2.2（Apache-2.0）。`models/`：官方 pose_landmarker_lite，和 Python 版同一个模型。

## 小鸟的声音

小鸟说的每句话都在 `lines.js` 里，用 MiniMax 预先录好放在 `voice/`，运行时不调用任何接口，页面里也没有 key。
某句没有录音时会用系统语音，所以改了台词要重新生成（只会录新增的句子）：

```bash
node tools/generate_voice.mjs --dry-run
node tools/generate_voice.mjs    # 终端里要有 MINIMAX_API_KEY 和 MINIMAX_VOICE_ID
```

## 本地运行

摄像头要求 HTTPS 或 localhost。

```bash
python3 -m http.server 8790 --directory chirpi/mobile
```

## 部署

这个文件夹本身就是网站，放到任何静态托管上都行。
