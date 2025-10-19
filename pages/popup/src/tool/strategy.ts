// =====================
// Binance K线响应类型

import type { StategySettingStateType } from '@extension/storage';

// =====================
export interface AlphaKlineResponse {
  code: string;
  message: string | null;
  messageDetail: string | null;
  success: boolean;
  data: string[][];
}

// =====================
// 市场稳定性返回类型
// =====================
export interface MarketStabilityResult {
  symbol: string;
  stable: boolean; // 是否可刷分
  trend: '上涨趋势' | '下跌趋势' | '横盘震荡';
  message: string; // 可读提示
}

// 提取 close
export const extractClosePrices = (klines: string[][]) => klines.map(k => parseFloat(k[4]));

/**
 * 算法1：线性趋势斜率检测（线性回归简化版）
 * 最近20根收盘价的斜率 > 0 即认为上涨趋势明显
 */
export const algo1_TrendSlope = (klines: string[][], toSlope = 0.000003): boolean => {
  const data = extractClosePrices(klines);
  if (data.length < 5) return false;
  const n = data.length;
  const avgX = (n - 1) / 2;
  const avgY = data.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - avgX) * (data[i] - avgY);
    den += Math.pow(i - avgX, 2);
  }
  const slope = num / den;
  console.log(slope);
  return slope > toSlope; // 正斜率代表上涨
};

/**
 * 算法2：动量连续上升检测
 * 连续数根k线收盘价高于前一根，判定为动量上涨
 */
export const algo2_Momentum = (klines: string[][], confirm = 3): boolean => {
  const data = extractClosePrices(klines);
  if (data.length < confirm + 1) return false;
  let count = 0;
  for (let i = data.length - confirm; i < data.length; i++) {
    if (data[i] > data[i - 1]) count++;
  }
  return count >= confirm; // 连涨 confirm 根
};

/**
 * 算法3：短期均线与长期均线方向差异
 * 均线方向差 > 阈值说明加速上行
 */
export const algo3_ShortVsLong = (klines: string[][], short = 5, long = 20) => {
  const data = extractClosePrices(klines);
  if (data.length < long) return false;
  const ma = (arr: number[], n: number) => arr.slice(-n).reduce((a, b) => a + b, 0) / n;
  const shortNow = ma(data, short);
  const longNow = ma(data, long);
  const prevShort = ma(data.slice(0, -1), short);
  const prevLong = ma(data.slice(0, -1), long);
  const shortSlope = shortNow - prevShort;
  const longSlope = longNow - prevLong;
  return shortSlope > longSlope && shortSlope > 0;
};

/**
 * 算法4：波动率收敛突破（低波动后上破）
 * 若波动率近期降低且最新价格突破区间上限 → 买入
 */
export const algo4_VolatilityBreak = (klines: string[][], lookback = 20) => {
  const data = extractClosePrices(klines);
  if (data.length < lookback) return false;
  const recent = data.slice(-lookback);
  const avg = recent.reduce((a, b) => a + b, 0) / lookback;
  const vol = Math.sqrt(recent.map(p => (p - avg) ** 2).reduce((a, b) => a + b, 0) / lookback);
  const upper = avg + vol * 1.2;
  const curr = recent[recent.length - 1];
  return curr > upper;
};

/**
 * 算法5：即时加速度检测
 * 连续上涨且涨幅递增，表示加速度上行
 */
// export const algo5_Acceleration = (klines: string[][], lookback = 10) => {
//   const data = extractClosePrices(klines);
//   if (data.length < lookback + 2) return false;

//   // 计算价格变化量（速度）
//   const velocity = [];
//   for (let i = 1; i < data.length; i++) {
//     velocity.push(data[i] - data[i - 1]);
//   }

//   // 计算加速度（速度的变化量）
//   const acceleration = [];
//   for (let i = 1; i < velocity.length; i++) {
//     acceleration.push(velocity[i] - velocity[i - 1]);
//   }

//   // 取最近 lookback 条加速度
//   const recent = acceleration.slice(-lookback);

//   // 判断加速度是否连续递增（趋势增强）
//   let increasing = 0;
//   for (let i = 1; i < recent.length; i++) {
//     if (recent[i] > recent[i - 1]) increasing++;
//   }

//   // 计算平均加速度
//   const avgAcc = recent.reduce((a, b) => a + b, 0) / recent.length;

//   // 条件：超过 70% 递增，且平均加速度 > 0
//   return increasing / recent.length > 0.7 && avgAcc > 0;
// };

export const algo5_Acceleration = (klines: string[][]) => {
  const data = extractClosePrices(klines);
  if (data.length < 4) return false;
  const a1 = data[data.length - 1] - data[data.length - 2];
  const a2 = data[data.length - 2] - data[data.length - 3];
  const a3 = data[data.length - 3] - data[data.length - 4];
  return a1 > a2 && a2 > a3 && a1 > 0;
};

/**
 * 统一分析输出
 */
export const analyzeFast = (
  klines: string[][],
  toSlope = 0.000003,
  confirm = 3,
  short = 5,
  long = 20,
  lookback = 20,
) => ({
  TrendSlope: algo1_TrendSlope(klines, toSlope),
  Momentum: algo2_Momentum(klines, confirm),
  ShortVsLong: algo3_ShortVsLong(klines, short, long),
  VolatilityBreak: algo4_VolatilityBreak(klines, lookback),
  Acceleration: algo5_Acceleration(klines),
});

export const checkMarketStable = async (
  api: string,
  symbol: string, // ALPHA_175USDT
  options: StategySettingStateType,
): Promise<MarketStabilityResult> => {
  const limit = options.limit;
  api = api.lastIndexOf('/') === api.length - 1 ? api.slice(0, -1) : api;
  const url = `${api}/bapi/defi/v1/public/alpha-trade/klines?interval=${'1s'}&limit=${limit}&symbol=${symbol}`;
  const res = await fetch(url);
  const json: AlphaKlineResponse = await res.json();

  if (!json.success || !Array.isArray(json.data)) {
    throw new Error(`获取 ${symbol} 市场数据失败`);
  }

  const data = json.data;

  const a = analyzeFast(data, options.toSlope, options.confirm, options.short, options.long, options.limit);
  // 可刷分判断
  const stable = a.TrendSlope || a.Momentum || a.ShortVsLong || a.VolatilityBreak || a.Acceleration;

  // 如果有两个指标以上为true，则判定为上涨趋势
  const trueCount = [a.TrendSlope, a.Momentum, a.ShortVsLong, a.VolatilityBreak, a.Acceleration].filter(
    (v: boolean) => v,
  ).length;

  const trend = trueCount >= options.upThreshold ? '上涨趋势' : '下跌趋势';

  const message = stable
    ? `✅ 可交易 (线性趋势斜率检测: ${a.TrendSlope}; 动量连续上升检测: ${a.Momentum}; 短期均线与长期均线方向差异: ${a.ShortVsLong}; 波动率收敛突破: ${a.VolatilityBreak}; 即时加速度检测: ${a.Acceleration})`
    : `❌ 不可交易 (线性趋势斜率检测: ${a.TrendSlope}; 动量连续上升检测: ${a.Momentum}; 短期均线与长期均线方向差异: ${a.ShortVsLong}; 波动率收敛突破: ${a.VolatilityBreak}; 即时加速度检测: ${a.Acceleration})`;

  return {
    symbol,
    stable,
    trend,
    message,
  };
};
