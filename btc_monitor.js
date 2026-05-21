/**
 * 比特币实时监控主程序
 *
 * 用法: node btc_monitor.js
 *
 * 功能:
 * - 连接币安 WebSocket 获取实时K线
 * - 计算 RSI / MACD / 布林带 / 均线 指标
 * - 多指标综合判断买卖时机
 * - 通过 Server酱 推送到微信
 */

const fs = require("fs");
const yaml = require("js-yaml");
const { BinanceClient } = require("./binance_client");
const { IndicatorCalculator } = require("./indicators");
const { WeChatNotifier } = require("./notifier");
const { SignalEngine } = require("./signal_engine");

// ─── 日志工具 ─────────────────────────────────

function log(level, msg) {
  const time = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  const prefix = { INFO: "ℹ", WARN: "⚠", ERR: "✗", SIGNAL: "⚡" }[level] || "·";
  console.log(`${time} ${prefix} ${msg}`);
}

// ─── 主程序 ─────────────────────────────────

class BTCMonitor {
  constructor(configPath = "config.yaml") {
    const raw = fs.readFileSync(configPath, "utf8");
    this.config = yaml.load(raw);

    const cfg = this.config;
    log("INFO", "=".repeat(50));
    log("INFO", "比特币实时监控系统");
    log("INFO", `交易对: ${cfg.trading.symbol} | K线: ${cfg.kline_interval}`);
    log("INFO", `通知冷却: ${cfg.notification.cooldown_minutes}分钟`);
    log("INFO", `强信号: ≥${cfg.signal.strong_threshold}指标 | 弱信号: ≥${cfg.signal.weak_threshold}指标`);
    log("INFO", "=".repeat(50));

    this.client = new BinanceClient(this.config);
    this.indicators = new IndicatorCalculator(this.config);
    this.signalEngine = new SignalEngine(this.config);

    const sendKey = this.config.notification.server_chan_key;
    this.notifier = (sendKey && sendKey !== "YOUR_SERVERCHAN_SENDKEY")
      ? new WeChatNotifier(sendKey) : null;

    if (!this.notifier) {
      log("WARN", "未配置 Server酱 SendKey，通知不可用！请编辑 config.yaml");
    }

    this._lastStatusTime = null;
    this._statusInterval = 4 * 60 * 60 * 1000; // 4小时
    this._klineCount = 0;
    this._24hChange = 0;
  }

  async start() {
    // 加载历史K线初始化指标
    log("INFO", "加载历史K线初始化指标...");
    const klines = await this.client.getKlines(100);
    for (const k of klines) {
      this.indicators.feed(parseFloat(k[4]));
    }
    log("INFO", `已加载 ${klines.length} 根历史K线`);

    // 获取行情
    const ticker = await this.client.get24hTicker();
    if (ticker) {
      this._24hChange = parseFloat(ticker.priceChangePercent || 0);
      log("INFO", `当前 $${parseFloat(ticker.lastPrice).toFixed(2)} | 24h: ${this._24hChange >= 0 ? "+" : ""}${this._24hChange.toFixed(2)}%`);
    }

    // 发送启动通知
    if (this.notifier) {
      const price = await this.client.getCurrentPrice();
      if (price) {
        await this.notifier.send(
          "🚀 BTC监控系统已启动",
          [
            `当前价格: $${price.toFixed(2)}`,
            `监控周期: ${this.config.kline_interval}`,
            `通知冷却: ${this.config.notification.cooldown_minutes}分钟`,
            ``,
            `有买卖信号时会自动推送通知`,
          ].join("\n")
        );
        this._lastStatusTime = Date.now();
      }
    }

    // 启动 WebSocket
    this.client.start((price, isClosed) => this._onKline(price, isClosed));
    log("INFO", "监控运行中，等待实时数据... (Ctrl+C 停止)");

    // 保持进程
    process.on("SIGINT", () => this.stop());
    process.on("SIGTERM", () => this.stop());
    setInterval(() => {}, 1000); // keep alive
  }

  async stop() {
    log("INFO", "正在停止...");
    this.client.stop();
    if (this.notifier) {
      await this.notifier.send(
        "⏸️ BTC监控系统已停止",
        `共监控 ${this._klineCount} 根K线\n停止时间: ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`
      );
    }
    log("INFO", "已停止");
    process.exit(0);
  }

  _onKline(price, isClosed) {
    this._klineCount++;
    if (!isClosed) return;

    const result = this.indicators.feed(price);
    const signal = this.signalEngine.evaluate(result, price);

    if (signal) {
      const emoji = signal.direction === "buy" ? "📈" : "📉";
      const action = signal.direction === "buy" ? "买入" : "卖出";
      log("SIGNAL", `${emoji} [${signal.strength}信号] BTC${action} @ $${signal.price.toFixed(2)} | 买入指标:${signal.buyCount} 卖出指标:${signal.sellCount}`);

      if (this.notifier) {
        this.notifier.sendSignal(
          signal.direction,
          signal.price,
          signal.indicators,
          signal.strength,
          this.config.trading.suggested_position
        );
      }
    } else {
      this._maybeStatus(price);
    }
  }

  async _maybeStatus(price) {
    const now = Date.now();
    if (!this._lastStatusTime || now - this._lastStatusTime >= this._statusInterval) {
      if (this.notifier) {
        await this.notifier.sendStatus(price, this._24hChange);
      }
      this._lastStatusTime = now;
    }
  }
}

// ─── 入口 ─────────────────────────────────

const monitor = new BTCMonitor();
monitor.start();
