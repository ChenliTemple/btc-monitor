/**
 * 币安 WebSocket + REST API 封装
 */

const WebSocket = require("ws");

class BinanceClient {
  constructor(config) {
    this.symbol = config.trading.symbol.toLowerCase();
    this.interval = config.kline_interval;
    this.testnet = config.binance.testnet;

    if (this.testnet) {
      this.restBase = "https://testnet.binance.vision";
      this.wsBase = "wss://testnet.binance.vision/ws";
    } else {
      this.restBase = "https://api.binance.com";
      this.wsBase = "wss://stream.binance.com:9443/ws";
    }

    this._ws = null;
    this._running = false;
    this._onKline = null;
  }

  // ─── REST API ─────────────────────────────────

  async get24hTicker() {
    try {
      const url = `${this.restBase}/api/v3/ticker/24hr?symbol=${this.symbol.toUpperCase()}`;
      const resp = await fetch(url);
      return await resp.json();
    } catch (err) {
      console.error(`[REST] 获取24h行情失败: ${err.message}`);
      return null;
    }
  }

  async getCurrentPrice() {
    try {
      const url = `${this.restBase}/api/v3/ticker/price?symbol=${this.symbol.toUpperCase()}`;
      const resp = await fetch(url);
      const data = await resp.json();
      return parseFloat(data.price);
    } catch (err) {
      console.error(`[REST] 获取当前价格失败: ${err.message}`);
      return null;
    }
  }

  async getKlines(limit = 100) {
    try {
      const url = `${this.restBase}/api/v3/klines?symbol=${this.symbol.toUpperCase()}&interval=${this.interval}&limit=${limit}`;
      const resp = await fetch(url);
      return await resp.json();
    } catch (err) {
      console.error(`[REST] 获取历史K线失败: ${err.message}`);
      return [];
    }
  }

  // ─── WebSocket ─────────────────────────────────

  start(onKline) {
    this._onKline = onKline;
    this._running = true;
    const stream = `${this.symbol}@kline_${this.interval}`;
    const wsUrl = `${this.wsBase}/${stream}`;
    this._connect(wsUrl);
  }

  _connect(wsUrl) {
    if (!this._running) return;

    console.log(`[WebSocket] 连接中...`);
    this._ws = new WebSocket(wsUrl);

    this._ws.on("open", () => {
      console.log(`[WebSocket] 已连接`);
    });

    this._ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const kline = msg.k;
        if (!kline) return;

        const closePrice = parseFloat(kline.c);
        const isClosed = kline.x;

        if (this._onKline) {
          this._onKline(closePrice, isClosed);
        }
      } catch (err) {
        // 忽略解析错误
      }
    });

    this._ws.on("error", (err) => {
      console.error(`[WebSocket] 错误: ${err.message}`);
    });

    this._ws.on("close", (code) => {
      console.log(`[WebSocket] 已断开 (code=${code})`);
      if (this._running) {
        console.log(`[WebSocket] 5秒后重连...`);
        setTimeout(() => this._connect(wsUrl), 5000);
      }
    });
  }

  stop() {
    this._running = false;
    if (this._ws) {
      this._ws.close();
    }
    console.log("[WebSocket] 已停止");
  }
}

module.exports = { BinanceClient };
