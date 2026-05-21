/**
 * 测试脚本 - 模拟价格数据验证信号检测
 * 用法: node test_signal.js
 */

const yaml = require("js-yaml");
const fs = require("fs");
const { IndicatorCalculator } = require("./indicators");
const { SignalEngine } = require("./signal_engine");

const config = yaml.load(fs.readFileSync("config.yaml", "utf8"));

const indicators = new IndicatorCalculator(config);
const engine = new SignalEngine(config);

// 模拟一段包含趋势变化的价格走势
// 先涨 (超买) 再跌 (超卖) 再涨
const testPrices = [
  // 横盘震荡阶段（填充缓冲区）
  ...Array(30).fill(95000),
  ...Array(5).fill(95100),
  ...Array(5).fill(95200),

  // 快速上涨 (制造超买)
  ...Array(3).fill(96000),
  ...Array(3).fill(97000),
  ...Array(3).fill(98500),
  ...Array(3).fill(100000),
  ...Array(2).fill(101500),

  // 快速下跌 (制造超卖)
  ...Array(3).fill(99000),
  ...Array(3).fill(96000),
  ...Array(3).fill(93000),
  ...Array(3).fill(91000),
  ...Array(2).fill(89500),
];

console.log("=== 信号检测测试 ===\n");

let signalCount = 0;
for (let i = 0; i < testPrices.length; i++) {
  const price = testPrices[i];
  const result = indicators.feed(price);
  const signal = engine.evaluate(result, price);

  if (signal) {
    signalCount++;
    const emoji = signal.direction === "buy" ? "📈" : "📉";
    const action = signal.direction === "buy" ? "买入" : "卖出";
    console.log(`[#${i}] ${emoji} ${signal.strength}信号: BTC${action} @ $${signal.price}`);
    console.log(`  买入指标: ${signal.buyCount} | 卖出指标: ${signal.sellCount}`);
    console.log(`  详情:`, signal.indicators);
    console.log("");
  } else if (i >= 60 && i % 5 === 0) {
    // 定期打印当前指标状态
    console.log(`[#${i}] 价格: $${price} | RSI:${result.rsi.toFixed(1)} MACD:${result.macdSignal} BB:${result.bbSignal} MA:${result.maSignal}`);
  }
}

console.log(`\n总计: ${testPrices.length} 根K线, 触发 ${signalCount} 个信号`);
console.log(signalCount > 0 ? "✅ 信号检测正常工作" : "❌ 未检测到任何信号，检查参数");
