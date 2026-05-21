/**
 * 一次性信号检查脚本（供 GitHub Actions 定时调用）
 *
 * 用法: node check_once.js
 *
 * 与 btc_monitor.js 的区别：
 * - 不保持长连接，通过 REST 拉取 K 线后立即退出
 * - 状态持久化到 state.json，跨运行保留去重信息
 */

const fs = require("fs");
const yaml = require("js-yaml");
const { IndicatorCalculator } = require("./indicators");
const { SignalEngine } = require("./signal_engine");
const { FeishuNotifier } = require("./notifier");

// ─── 状态持久化 ─────────────────────────────

const STATE_FILE = "state.json";

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { lastNotifyTime: null, lastDirection: null, lastPrice: 0 };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── 主逻辑 ─────────────────────────────────

async function main() {
  const config = yaml.load(fs.readFileSync("config.yaml", "utf8"));

  const symbol = config.trading.symbol.toUpperCase();
  const interval = config.kline_interval;
  const testnet = config.binance.testnet;
  const base = testnet
    ? "https://testnet.binance.vision"
    : "https://api.binance.com";

  console.log(`[${new Date().toISOString()}] BTC Monitor Check`);
  console.log(`  Symbol: ${symbol}  Interval: ${interval}  Testnet: ${testnet}`);

  // 恢复状态
  const state = loadState();

  // 拉取 K 线
  const url = `${base}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=100`;
  const resp = await fetch(url);
  const klines = await resp.json();

  if (!Array.isArray(klines) || klines.length < 50) {
    console.error("K线数据不足");
    return;
  }

  // 计算指标
  const indicators = new IndicatorCalculator(config);
  for (let i = 0; i < klines.length - 1; i++) {
    indicators.feed(parseFloat(klines[i][4]));
  }

  // 最后一根 K 线（已闭合）
  const lastKline = klines[klines.length - 2];
  const lastPrice = parseFloat(lastKline[4]);

  // 最新一根（可能未闭合）
  const latestKline = klines[klines.length - 1];
  const latestPrice = parseFloat(latestKline[4]);
  const latestClosed = latestKline[11]; // x 字段

  // 只在有已闭合K线时才判断
  const result = indicators.feed(lastPrice);

  // 恢复引擎冷却状态
  const engine = new SignalEngine(config);
  if (state.lastNotifyTime) {
    engine._lastNotifyTime = new Date(state.lastNotifyTime);
    engine._lastSignal = {
      direction: state.lastDirection,
      price: state.lastPrice,
    };
  }

  const signal = engine.evaluate(result, lastPrice);

  // 获取24h行情
  const tickerResp = await fetch(
    `${base}/api/v3/ticker/24hr?symbol=${symbol}`
  );
  const ticker = await tickerResp.json();
  const change24h = parseFloat(ticker.priceChangePercent || 0);

  // 打印当前指标
  console.log(
    `  Price: $${lastPrice.toFixed(2)} | ` +
    `RSI: ${result.rsi.toFixed(1)} | ` +
    `MACD: ${result.macdSignal} | ` +
    `BB: ${result.bbSignal} | ` +
    `MA: ${result.maSignal}`
  );

  if (signal) {
    const emoji = signal.direction === "buy" ? "📈" : "📉";
    const action = signal.direction === "buy" ? "买入" : "卖出";
    console.log(
      `${emoji} [${signal.strength}] BTC${action} @ $${signal.price.toFixed(2)}`
    );

    // 发送飞书通知
    const webhook = config.notification.feishu_webhook;
    if (webhook && webhook !== "YOUR_FEISHU_WEBHOOK_URL") {
      const notifier = new FeishuNotifier(webhook);
      await notifier.sendSignal(
        signal.direction,
        signal.price,
        signal.indicators,
        signal.strength,
        config.trading.suggested_position
      );
    }

    // 持久化状态
    state.lastNotifyTime = new Date().toISOString();
    state.lastDirection = signal.direction;
    state.lastPrice = signal.price;
    saveState(state);
    console.log("  状态已更新");
  }

  // 每4小时行情播报
  const now = Date.now();
  const lastStatus = state.lastStatusTime ? new Date(state.lastStatusTime).getTime() : 0;
  if (now - lastStatus > 4 * 60 * 60 * 1000) {
    const webhook = config.notification.feishu_webhook;
    if (webhook && webhook !== "YOUR_FEISHU_WEBHOOK_URL") {
      const notifier = new FeishuNotifier(webhook);
      await notifier.sendStatus(lastPrice, change24h);
      state.lastStatusTime = new Date().toISOString();
      saveState(state);
    }
  }

  console.log("  Done.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
