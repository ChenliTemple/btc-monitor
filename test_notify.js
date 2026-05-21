/**
 * 飞书通知测试
 * 用法: node test_notify.js
 */

const yaml = require("js-yaml");
const fs = require("fs");
const { FeishuNotifier } = require("./notifier");

const config = yaml.load(fs.readFileSync("config.yaml", "utf8"));
const webhook = config.notification.feishu_webhook;

if (!webhook || webhook === "YOUR_FEISHU_WEBHOOK_URL") {
  console.error("❌ 未配置飞书 Webhook，请先编辑 config.yaml");
  process.exit(1);
}

console.log(`测试目标: ${webhook.slice(0, 50)}...`);

const notifier = new FeishuNotifier(webhook);

(async () => {
  // 测试普通消息
  console.log("\n1. 发送普通消息...");
  const ok1 = await notifier.send(
    "🧪 测试消息",
    "如果你看到这条消息，说明**飞书推送配置成功**！\n\nBTC监控系统已就绪。"
  );
  console.log(ok1 ? "   ✅ 成功" : "   ❌ 失败");

  // 测试信号消息
  console.log("\n2. 发送模拟买入信号...");
  const ok2 = await notifier.sendSignal(
    "buy",
    98500.50,
    {
      "RSI": "RSI: 28.3 (超卖)",
      "MACD": "MACD: 金叉 ✓",
      "布林带": "布林带: 触及下轨 ✓",
    },
    "强",
    0.001
  );
  console.log(ok2 ? "   ✅ 成功" : "   ❌ 失败");

  // 测试行情播报
  console.log("\n3. 发送行情播报...");
  const ok3 = await notifier.sendStatus(98500.50, 2.35);
  console.log(ok3 ? "   ✅ 成功" : "   ❌ 失败");

  console.log("\n📱 请检查飞书群是否收到 3 条消息");
})();
