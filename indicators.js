/**
 * 技术指标计算模块
 * RSI, MACD, 布林带, 均线交叉
 */

class IndicatorCalculator {
  constructor(config) {
    const ic = config.indicators;
    this.rsiPeriod = ic.rsi.period;
    this.rsiOversold = ic.rsi.oversold;
    this.rsiOverbought = ic.rsi.overbought;

    this.macdFast = ic.macd.fast;
    this.macdSlow = ic.macd.slow;
    this.macdSignalPeriod = ic.macd.signal;

    this.bbPeriod = ic.bollinger.period;
    this.bbStd = ic.bollinger.std_dev;

    this.maShort = ic.ma.short_period;
    this.maLong = ic.ma.long_period;

    // 价格缓存（只保留计算所需的最大长度）
    this.maxPeriod = Math.max(
      this.rsiPeriod + 1,
      this.macdSlow + this.macdSignalPeriod,
      this.bbPeriod,
      this.maLong
    );
    this._prices = [];

    // MACD 中间状态
    this._macdEmaFast = 0;
    this._macdEmaSlow = 0;
    this._macdSignalEma = 0;
    this._prevMacd = 0;
    this._prevMacdSignal = 0;
    this._initialized = false;
  }

  feed(price) {
    this._prices.push(price);
    if (this._prices.length > this.maxPeriod + 200) {
      this._prices = this._prices.slice(-this.maxPeriod - 50);
    }
    return this._evaluate(price);
  }

  _evaluate(price) {
    const prices = this._prices;
    const n = prices.length;
    const result = {
      rsi: 50, rsiSignal: "neutral",
      macd: 0, macdSignalLine: 0, macdHistogram: 0, macdSignal: "neutral",
      bbUpper: 0, bbMiddle: 0, bbLower: 0, bbSignal: "neutral",
      maShort: 0, maLong: 0, maSignal: "neutral",
    };

    if (n < 2) return result;

    // RSI
    if (n >= this.rsiPeriod + 1) {
      result.rsi = this._calcRSI(prices);
      if (result.rsi <= this.rsiOversold) result.rsiSignal = "buy";
      else if (result.rsi >= this.rsiOverbought) result.rsiSignal = "sell";
    }

    // MACD
    if (n >= this.macdSlow + this.macdSignalPeriod) {
      const [macd, signal, hist] = this._calcMACD(prices);
      result.macd = macd;
      result.macdSignalLine = signal;
      result.macdHistogram = hist;
      result.macdSignal = this._macdCross();
    }

    // 布林带
    if (n >= this.bbPeriod) {
      const [upper, middle, lower] = this._calcBollinger(prices);
      result.bbUpper = upper;
      result.bbMiddle = middle;
      result.bbLower = lower;
      if (price <= lower) result.bbSignal = "buy";
      else if (price >= upper) result.bbSignal = "sell";
    }

    // 均线交叉
    if (n >= this.maLong + 1) {
      result.maShort = this._sma(prices.slice(-this.maShort));
      result.maLong = this._sma(prices.slice(-this.maLong));
      const prevShort = this._sma(prices.slice(-this.maShort - 1, -1));
      const prevLong = this._sma(prices.slice(-this.maLong - 1, -1));
      if (prevShort <= prevLong && result.maShort > result.maLong) {
        result.maSignal = "buy";
      } else if (prevShort >= prevLong && result.maShort < result.maLong) {
        result.maSignal = "sell";
      }
    }

    return result;
  }

  _calcRSI(prices) {
    const period = this.rsiPeriod;
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  _calcMACD(prices) {
    const fastK = 2 / (this.macdFast + 1);
    const slowK = 2 / (this.macdSlow + 1);
    const signalK = 2 / (this.macdSignalPeriod + 1);

    if (!this._initialized) {
      this._macdEmaFast = this._sma(prices.slice(0, this.macdFast));
      this._macdEmaSlow = this._sma(prices.slice(0, this.macdSlow));
      this._macdSignalEma = this._calcInitialSignalEMA(prices);
      this._initialized = true;
    }

    this._macdEmaFast = prices[prices.length - 1] * fastK + this._macdEmaFast * (1 - fastK);
    this._macdEmaSlow = prices[prices.length - 1] * slowK + this._macdEmaSlow * (1 - slowK);

    const macd = this._macdEmaFast - this._macdEmaSlow;
    this._macdSignalEma = macd * signalK + this._macdSignalEma * (1 - signalK);
    const histogram = macd - this._macdSignalEma;

    this._prevMacd = macd;
    this._prevMacdSignal = this._macdSignalEma;

    return [macd, this._macdSignalEma, histogram];
  }

  _calcInitialSignalEMA(prices) {
    let val = this._sma(prices.slice(0, this.macdSignalPeriod));
    const k = 2 / (this.macdSignalPeriod + 1);
    for (let i = this.macdSignalPeriod; i < prices.length; i++) {
      const macdFast = prices[i] * (2 / (this.macdFast + 1)) + this._macdEmaFast * (1 - 2 / (this.macdFast + 1));
      const macdSlow = prices[i] * (2 / (this.macdSlow + 1)) + this._macdEmaSlow * (1 - 2 / (this.macdSlow + 1));
      const macd = macdFast - macdSlow;
      val = macd * k + val * (1 - k);
    }
    return val;
  }

  _macdCross() {
    if (this._prevMacd > this._prevMacdSignal) return "buy";
    if (this._prevMacd < this._prevMacdSignal) return "sell";
    return "neutral";
  }

  _calcBollinger(prices) {
    const recent = prices.slice(-this.bbPeriod);
    const middle = this._sma(recent);
    const variance = recent.reduce((s, p) => s + (p - middle) ** 2, 0) / this.bbPeriod;
    const std = Math.sqrt(variance);
    return [middle + this.bbStd * std, middle, middle - this.bbStd * std];
  }

  _sma(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

module.exports = { IndicatorCalculator };
