# BTC Monitor - 比特币实时监控与信号通知

实时监控比特币价格，综合 RSI / MACD / 布林带 / 均线四大技术指标，检测买卖时机并通过**飞书**推送通知。

通过 **GitHub Actions** 每 15 分钟自动运行，无需服务器，完全免费。

## 功能

- GitHub Actions 定时运行，每 15 分钟检查一次
- 连接币安 REST API 获取 K 线数据
- RSI(14)、MACD(12/26/9)、布林带(20)、MA(5/20) 四大指标实时计算
- 多指标综合判断：≥3个指向 → 强信号，≥2个指向 → 弱信号
- 飞书机器人卡片推送，30分钟冷却 + 价格波动去重
- 每4小时定时行情播报
- 本地也支持长连接模式：`npm start`

## 部署到 GitHub Actions

### 1. Fork 或 Clone 本仓库

```bash
git clone https://github.com/ChenliTemple/btc-monitor.git
cd btc-monitor
```

### 2. 创建飞书机器人

1. 在飞书中创建一个群聊
2. 群设置 → 群机器人 → 添加机器人 → **自定义机器人**
3. 安全设置选择 **自定义关键词**，填入 `BTC`
4. 复制 Webhook 地址

### 3. 配置并推送

```bash
cp config.example.yaml config.yaml
# 编辑 config.yaml，填入飞书 Webhook 地址
git add config.yaml  # 注意: config.yaml 默认在 .gitignore 中
git commit -m "Add feishu webhook"
git push
```

> **安全提示**: 飞书 Webhook 包含在 config.yaml 中。建议将仓库设为 **私有** 或使用 GitHub Secrets 存储敏感信息。

### 4. 启用 GitHub Actions

推送后，GitHub Actions 会自动按 cron 表达式 `*/15 * * * *` 每 15 分钟运行一次。可在 Actions 页面手动触发 `workflow_dispatch` 立即测试。

## 本地运行

```bash
npm install

# 一次性检查（适合 cron / 本地测试）
node check_once.js

# 长连接实时监控
npm start
```

## 信号策略

| 指标 | 买入信号 | 卖出信号 |
|------|---------|---------|
| RSI(14) | < 30 超卖 | > 70 超买 |
| MACD | 金叉 | 死叉 |
| 布林带 | 触及下轨 | 触及上轨 |
| 均线 MA5/20 | 金叉 | 死叉 |

## 配置说明

见 [config.example.yaml](config.example.yaml)

## 文件说明

| 文件 | 用途 |
|------|------|
| `btc_monitor.js` | 本地长连接模式 |
| `check_once.js` | GitHub Actions 一次性检查 |
| `state.json` | 跨运行状态持久化 |
| `.github/workflows/monitor.yml` | Actions 定时任务 |
