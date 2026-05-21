/**
 * 通知推送模块
 * 通过 Server酱 推送到微信
 */

class WeChatNotifier {
  constructor(sendKey) {
    this.sendKey = sendKey;
    this.apiUrl = `https://sctapi.ftqq.com/${sendKey}.send`;
    this._lastSignalTime = null;
    this._lastSignalDirection = null;
    this._lastSignalPrice = 0;
  }

  async send(title, content = "") {
    try {
      const body = new URLSearchParams({
        title,
        desp: content.replace(/\n/g, "\n\n"),
      });

      const resp = await fetch(this.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
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

    let indicatorText = "";
    for (const [name, val] of Object.entries(indicatorDetails)) {
      indicatorText += `  ${val}\n`;
    }

    const content = [
      `## 当前价格: $${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ``,
      `### 触发指标:`,
      indicatorText || `  综合趋势判断`,
      ``,
      `---`,
      ``,
      `- 建议仓位: ${suggestedPosition} BTC`,
      `- 时间: ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`,
    ].join("\n");

    const title = `${emoji} BTC${action}信号 [${strength}]`;
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
    const content = [
      `## 当前价格: $${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ``,
      `24h涨跌: ${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%`,
      ``,
      `系统运行正常 | ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`,
    ].join("\n");
    return this.send(`${emoji} BTC行情播报 $${Math.round(price).toLocaleString()}`, content);
  }
}

module.exports = { WeChatNotifier };
