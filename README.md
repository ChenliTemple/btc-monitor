# BTC Monitor - 比特币实时监控与信号通知

实时监控比特币价格，综合 RSI / MACD / 布林带 / 均线四大技术指标，检测买卖时机并通过**微信**推送通知。

## 功能

- 连接币安 WebSocket 获取实时K线数据
- RSI(14)、MACD(12/26/9)、布林带(20)、MA(5/20) 四大指标实时计算
- 多指标综合判断：≥3个指向 → 强信号，≥2个指向 → 弱信号
- Server酱推送到微信，30分钟冷却 + 价格波动去重
- 每4小时定时行情播报

## 快速开始

### 1. 获取通知密钥

在 [Server酱](https://sct.ftqq.com/) 注册，获取 SendKey。

### 2. 配置

```bash
cp config.example.yaml config.yaml
# 编辑 config.yaml，填入你的 Server酱 SendKey
```

### 3. 运行

```bash
npm install
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
