/**
 * 通知推送模块
 * 通过飞书机器人 Webhook 推送消息
 */

class FeishuNotifier {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
    this._lastSignalTime = null;
    this._lastSignalDirection = null;
    this._lastSignalPrice = 0;
  }

  async send(title, content = "") {
    try {
      const body = JSON.stringify({
        msg_type: "interactive",
        card: {
          header: {
            title: { content: title, tag: "plain_text" },
            template: title.includes("涨") || title.includes("买入") ? "red" : "blue",
          },
          elements: [
            { tag: "markdown", content },
            { tag: "hr" },
            {
              tag: "note",
              elements: [
                {
                  tag: "plain_text",
                  content: `BTC Monitor | ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`,
                },
              ],
            },
          ],
        },
      });

      const resp = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const data = await resp.json();
      if (data.code === 0) {
        console.log(`[通知] 发送成功: ${title}`);
        return true;
      } else {
        console.error(`[通知] 发送失败: ${JSON.stringify(data)}`);
        return false;
      }
    } catch (err) {
      console.error(`[通知] 异常: ${err.message}`);
      return false;
    }
  }

  async sendSignal(direction, price, indicatorDetails, strength, suggestedPosition) {
    const emoji = direction === "buy" ? "📈" : "📉";
    const action = direction === "buy" ? "买入" : "卖出";
    const priceStr = price.toLocaleString("en-US", {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });

    let indicatorText = "";
    for (const [name, val] of Object.entries(indicatorDetails)) {
      indicatorText += `**${name}**：${val}\n`;
    }

    const title = `${emoji} BTC${action}信号 [${strength}]`;

    const content = [
      `**当前价格：$${priceStr}**`,
      ``,
      `**触发指标：**`,
      indicatorText || `  综合趋势判断`,
      ``,
      `建议仓位：${suggestedPosition} BTC`,
    ].join("\n");

    const ok = await this.send(title, content);

    if (ok) {
      this._lastSignalTime = new Date();
      this._lastSignalDirection = direction;
      this._lastSignalPrice = price;
    }

    return ok;
  }

  async sendStatus(price, change24h) {
    const emoji = change24h >= 0 ? "🟢" : "🔴";
    const priceStr = price.toLocaleString("en-US", {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
    const content = [
      `**当前价格：$${priceStr}**`,
      `24h涨跌：${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%`,
      ``,
      `系统运行正常`,
    ].join("\n");
    return this.send(`${emoji} BTC行情播报 $${Math.round(price).toLocaleString()}`, content);
  }
}

module.exports = { FeishuNotifier };
