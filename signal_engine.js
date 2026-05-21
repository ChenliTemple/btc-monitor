/**
 * 信号引擎
 * 综合多个技术指标判断买卖时机
 */

class SignalEngine {
  constructor(config) {
    this.strongThreshold = config.signal.strong_threshold;
    this.weakThreshold = config.signal.weak_threshold;
    this.cooldownMs = config.notification.cooldown_minutes * 60 * 1000;
    this.priceThreshold = config.notification.price_change_threshold_pct / 100;

    this._lastSignal = null;
    this._lastNotifyTime = null;
  }

  evaluate(indicators, price) {
    const buySignals = [];
    const sellSignals = [];

    if (indicators.rsiSignal === "buy") buySignals.push("rsi");
    else if (indicators.rsiSignal === "sell") sellSignals.push("rsi");

    if (indicators.macdSignal === "buy") buySignals.push("macd");
    else if (indicators.macdSignal === "sell") sellSignals.push("macd");

    if (indicators.bbSignal === "buy") buySignals.push("bb");
    else if (indicators.bbSignal === "sell") sellSignals.push("bb");

    if (indicators.maSignal === "buy") buySignals.push("ma");
    else if (indicators.maSignal === "sell") sellSignals.push("ma");

    const buyCount = buySignals.length;
    const sellCount = sellSignals.length;

    let direction, count, triggered;
    if (buyCount > sellCount && buyCount >= this.weakThreshold) {
      direction = "buy";
      count = buyCount;
      triggered = buySignals;
    } else if (sellCount > buyCount && sellCount >= this.weakThreshold) {
      direction = "sell";
      count = sellCount;
      triggered = sellSignals;
    } else {
      return null;
    }

    const strength = count >= this.strongThreshold ? "强" : "弱";

    if (!this._shouldNotify(direction, price)) {
      console.log(`[信号] 去重过滤: ${direction} @ ${price.toFixed(2)}`);
      return null;
    }

    const indicatorDetails = {};
    for (const name of triggered) {
      if (name === "rsi") {
        indicatorDetails["RSI"] = `RSI: ${indicators.rsi.toFixed(1)} (${direction === "buy" ? "超卖" : "超买"})`;
      } else if (name === "macd") {
        indicatorDetails["MACD"] = `MACD: ${direction === "buy" ? "金叉" : "死叉"} ✓`;
      } else if (name === "bb") {
        indicatorDetails["布林带"] = `布林带: ${direction === "buy" ? "触及下轨" : "触及上轨"} ✓`;
      } else if (name === "ma") {
        indicatorDetails["均线"] = `均线: ${direction === "buy" ? "金叉" : "死叉"} ✓`;
      }
    }

    const signal = {
      direction,
      strength,
      price,
      buyCount,
      sellCount,
      indicators: indicatorDetails,
      timestamp: new Date(),
    };

    this._lastSignal = signal;
    this._lastNotifyTime = new Date();

    return signal;
  }

  _shouldNotify(direction, price) {
    if (!this._lastSignal || !this._lastNotifyTime) return true;

    const now = Date.now();

    // 时间冷却
    if (now - this._lastNotifyTime.getTime() < this.cooldownMs) {
      const elapsed = Math.round((now - this._lastNotifyTime.getTime()) / 60000);
      console.log(`[信号] 冷却中，距上次 ${elapsed} 分钟`);
      return false;
    }

    // 同方向价格变动检查
    if (this._lastSignal.direction === direction && this._lastSignal.price > 0) {
      const change = Math.abs(price - this._lastSignal.price) / this._lastSignal.price;
      if (change < this.priceThreshold) {
        return false;
      }
    }

    return true;
  }
}

module.exports = { SignalEngine };
