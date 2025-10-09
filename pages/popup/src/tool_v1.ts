import { getIsSell } from './tool';

declare global {
  interface Window {
    setInputValue: (selector: string, value: string) => void;
  }
}

export const callChromeJs = async <T, A extends any[] = []>(
  tab: chrome.tabs.Tab,
  args: A,
  func: (...args: A) => { error: string; val: T } | Promise<{ error: string; val: T }>,
): Promise<T> => {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func,
    world: 'MAIN',
    args: (args ?? []) as A,
  });

  if (!result?.result) {
    throw new Error('脚本执行失败：无返回结果');
  }

  const { error, val } = result.result;

  if (error) {
    throw new Error(error);
  }

  return val;
};

// 获取alpha 接口id
export const getId = async (tab: chrome.tabs.Tab) => {
  const name = await callChromeJs(tab, [], () => {
    try {
      const dom = document.querySelector('.bg-BasicBg .text-PrimaryText');
      return { error: '', val: dom?.textContent.trim() };
    } catch (err: any) {
      return { error: err.message, val: '' };
    }
  });
  if (!name) return '';
  const listRequest = await fetch(
    'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list',
  );
  const list = (await listRequest.json()).data as { alphaId: string; symbol: string }[];
  const cur = list.find(c => c.symbol === name);
  if (!cur) return '';
  return `${cur.alphaId}USDT`;
};

export interface Trade {
  T: number; // 时间戳
  p: string; // 价格
  q: string; // 成交量
  m: boolean; // 是否卖方主动
}

// 获取价格
export const getPrice = async (symbol: string) => {
  const request = await fetch(
    `https://www.binance.com/bapi/defi/v1/public/alpha-trade/agg-trades?symbol=${symbol}&limit=1`,
  );
  const json = (await request.json()) as { data: Trade[] };
  const cur = json.data[json.data.length - 1];
  return cur.p;
};

export const getPriceList = async (symbol: string) => {
  const request = await fetch(
    `https://www.binance.com/bapi/defi/v1/public/alpha-trade/agg-trades?symbol=${symbol}&limit=50`,
  );
  const json = (await request.json()) as { data: AggTrade[] };
  return json.data;
};

export const jumpToSell = async (tab: chrome.tabs.Tab) =>
  await callChromeJs(tab, [], async () => {
    try {
      const sellPanel = document.querySelector('.bn-tab__buySell[aria-controls="bn-tab-pane-1"]') as HTMLButtonElement;
      if (!sellPanel) throw new Error('卖出面板元素不存在, 请确认页面是否正确');
      sellPanel.click();
      await new Promise(resolve => setTimeout(resolve, 300));
      sellPanel.click();
      await new Promise(resolve => setTimeout(resolve, 300));
      return { error: '', val: true };
    } catch (error: any) {
      return { error: error.message, val: false };
    }
  });

export const jumpToBuy = async (tab: chrome.tabs.Tab) =>
  await callChromeJs(tab, [], async () => {
    try {
      const buyPanel = document.querySelector('.bn-tab__buySell[aria-controls="bn-tab-pane-0"]') as HTMLButtonElement;
      if (!buyPanel) throw new Error('买入面板元素不存在, 请确认页面是否正确');
      buyPanel.click();
      await new Promise(resolve => setTimeout(resolve, 300));
      buyPanel.click();
      await new Promise(resolve => setTimeout(resolve, 300));
      return { error: '', val: true };
    } catch (error: any) {
      return { error: error.message, val: false };
    }
  });

export const setPrice = async (tab: chrome.tabs.Tab, price: string) =>
  await callChromeJs(tab, [price], async price => {
    try {
      // 反向订单校验
      const btn = document.querySelector(
        '.flexlayout__tab[data-layout-path="/r1/ts0/t0"] .bn-checkbox',
      ) as HTMLButtonElement;
      if (btn) {
        const isChecked = btn.getAttribute('aria-checked') === 'true';
        // 点击反向按钮
        if (isChecked) btn.click();
      }
      // 卖出价格
      window.setInputValue('input#limitPrice', price);
      await new Promise(resolve => setTimeout(resolve, 16));
      return { error: '', val: true };
    } catch (error: any) {
      return { error: error.message, val: false };
    }
  });

export const setRangeValue = async (tab: chrome.tabs.Tab, value: string) =>
  await callChromeJs(tab, [value], async value => {
    try {
      // 设置卖出数量
      window.setInputValue('.flexlayout__tab[data-layout-path="/r1/ts0/t0"] input[type="range"]', value);
      await new Promise(resolve => setTimeout(resolve, 16));
      return { error: '', val: true };
    } catch (error: any) {
      return { error: error.message, val: false };
    }
  });

export const setLimitTotal = async (tab: chrome.tabs.Tab, value: string) =>
  await callChromeJs(tab, [value], async value => {
    try {
      // 设置卖出数量
      window.setInputValue('.flexlayout__tab[data-layout-path="/r1/ts0/t0"] #limitTotal', value);
      await new Promise(resolve => setTimeout(resolve, 16));
      return { error: '', val: true };
    } catch (error: any) {
      return { error: error.message, val: false };
    }
  });

// 提交卖出
export const callSubmit = async (tab: chrome.tabs.Tab) =>
  await callChromeJs(tab, [], async () => {
    try {
      // 确认卖出
      const submitBtn = document.querySelector(
        '.flexlayout__tab[data-layout-path="/r1/ts0/t0"] button.bn-button',
      ) as HTMLButtonElement;
      if (!submitBtn) throw new Error('提交按钮不存在, 请确认页面是否正确');
      submitBtn.click();
      // 关闭弹窗
      let count = 0;
      // 1000 / 30 每秒30fps 最多等待1秒
      while (count < 32) {
        await new Promise(resolve => setTimeout(resolve, 1000 / 30));
        const btn = document
          .querySelector(`div[role='dialog'][class='bn-modal-wrap data-size-small']`)
          ?.querySelector('.bn-button__primary') as HTMLButtonElement;
        if (btn) {
          btn.click();
          await new Promise(resolve => setTimeout(resolve, 500));
          return { error: '', val: false };
        }
        count++;
      }
      return { error: '操作超时，刷新页面后重试', val: true };
    } catch (error: any) {
      return { error: error.message, val: true };
    }
  });

// 等待订单完成
export const waitOrder = async (tab: chrome.tabs.Tab, timeout: number = 3) =>
  await callChromeJs(tab, [timeout], async timeout => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const start = Date.now();
      while (true) {
        // 检测是否有订单
        const cancelAll = document.querySelector(
          '#bn-tab-pane-orderOrder th[aria-colindex="9"] div[class="text-TextLink cursor-pointer"]',
        ) as HTMLButtonElement;
        console.log('cancelAll', cancelAll);
        // 如果不存在则代表未有订单
        if (!cancelAll) break;
        // 如果存在 且超时操作取消 并且返回超时 timeout 单位（s）
        if (Date.now() - start > timeout * 1000) {
          cancelAll.click();
          await new Promise(resolve => setTimeout(resolve, 16));
          // 确认弹窗
          const btn = document.querySelector(
            '.bn-modal-confirm .bn-modal-confirm-actions .bn-button__primary',
          ) as HTMLButtonElement;
          if (btn) btn.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          return { error: '等待订单超时，等待重试', val: true };
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      return { error: '', val: true };
    } catch (error: any) {
      return { error: error.message, val: false };
    }
  });

// 是否出现验证弹窗
export const isAuthModal = async (tab: chrome.tabs.Tab) =>
  await callChromeJs(tab, [], () => {
    try {
      const dialog = document.querySelector('#mfa-shadow-host');
      if (dialog) {
        return { error: '', val: true };
      }
      return { error: '', val: false };
    } catch (error: any) {
      return { error: error.message, val: false };
    }
  });

// 兜底卖出
export const backSell = async (
  tab: chrome.tabs.Tab,
  symbol: string,
  appendLog: (msg: string, type: 'success' | 'error' | 'info') => void,
  timeout: number = 3,
) => {
  while (true) {
    try {
      const isSell = await getIsSell(tab);
      if (!isSell) return;
      await jumpToSell(tab); // 跳转卖出
      const price = await getPrice(symbol); // 获取价格
      if (!price) throw new Error('获取价格失败');
      // 设置卖出价格
      await setPrice(tab, price);
      // 设置卖出数量
      await setRangeValue(tab, '100');
      // 执行卖出
      await callSubmit(tab);
      // 判断是否出现验证码
      const isAuth = await isAuthModal(tab);
      // 出现验证弹窗等待
      if (isAuth) await new Promise(resolve => setTimeout(resolve, 3000));
      // 等待订单
      await waitOrder(tab, timeout);
      appendLog(`卖出成功 价格：${price}`, 'success');
    } catch (error: any) {
      console.error(error);
      appendLog(error.message, 'error');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

export type AggTrade = {
  a: number;
  p: string; // price as string
  q: string; // qty as string
  f: number;
  l: number;
  T: number; // ms timestamp
  m?: boolean;
};

/**
 * 检测从 buyPrice/buyIndex/buyTs 开始到窗口内是否出现超过 thresholdPct 下跌
 */
export const detectDropRisk = (
  trades: AggTrade[],
  options?: {
    buyPrice?: number;
    buyIndex?: number;
    buyTs?: number;
    windowMs?: number;
    thresholdPct?: number;
    volumeWeighted?: boolean;
  },
) => {
  const { buyPrice, buyIndex, buyTs, windowMs = 5000, thresholdPct = 0.1, volumeWeighted = false } = options ?? {};

  if (!Array.isArray(trades) || trades.length === 0) {
    throw new Error('invalid trades');
  }

  // 找到起点索引
  let startIdx = 0;
  if (typeof buyIndex === 'number') {
    startIdx = Math.max(0, Math.min(trades.length - 1, buyIndex));
  } else if (typeof buyTs === 'number') {
    startIdx = trades.findIndex(t => t.T >= buyTs);
    if (startIdx === -1) startIdx = trades.length - 1;
  } else if (typeof buyPrice === 'number') {
    // 如果只给了价格，默认从第一个 >= buyPrice 的位置开始（或从 0）
    startIdx = 0;
  }

  // 计算起始价格
  let startPrice: number;
  if (typeof buyPrice === 'number') {
    startPrice = buyPrice;
  } else {
    startPrice = parseFloat(trades[startIdx].p);
  }
  if (!isFinite(startPrice) || startPrice <= 0) throw new Error('invalid start price');

  // 计算窗口截止时间（基于 startIdx 的时间）
  const startTs = trades[startIdx].T;
  const endTs = startTs + windowMs;

  // 在窗口内找最低价和（可选）低价成交量总和
  let minPrice = startPrice;
  let minTrade: AggTrade | null = null;
  let lowPriceVolume = 0;
  let totalVolume = 0;

  for (let i = startIdx; i < trades.length; i++) {
    const t = trades[i];
    if (t.T > endTs) break;
    const price = parseFloat(t.p);
    const vol = parseFloat(t.q) || 0;
    totalVolume += vol;

    if (price < minPrice) {
      minPrice = price;
      minTrade = t;
    }
    // 记录低于某个阈（如低于 startPrice * (1 - thresholdPct/100)）的量
    const thresholdPrice = startPrice * (1 - thresholdPct / 100);
    if (price <= thresholdPrice) {
      lowPriceVolume += vol;
    }
  }

  const worstDropPct = ((startPrice - minPrice) / startPrice) * 100; // 百分比
  const hasRisk = worstDropPct > thresholdPct;

  const res = {
    hasRisk,
    worstDropPct, // 百分比, e.g. 0.056 => 0.056%
    buyPrice: startPrice,
    minPrice,
    minTrade,
    checkedStartTs: startTs,
    checkedEndTs: endTs,
    thresholdPct,
    lowPriceVolume,
    totalVolume,
    lowPriceVolumeRatio: 0,
  };

  if (volumeWeighted) {
    res.lowPriceVolume = lowPriceVolume;
    res.totalVolume = totalVolume;
    res.lowPriceVolumeRatio = totalVolume > 0 ? lowPriceVolume / totalVolume : 0;
  }

  return res;
};

// 获取余额
export const getBalance = async (tab: chrome.tabs.Tab) => {
  await jumpToBuy(tab);
  return await callChromeJs(tab, [], async () => {
    try {
      const UsdtEle = document.querySelector(
        '.flexlayout__tab[data-layout-path="/r1/ts0/t0"] .t-caption1 div[class~="text-PrimaryText"]',
      ) as HTMLSpanElement;
      if (!UsdtEle) throw new Error('获取不到余额, 请确认页面是否正确');
      // 返回余额（字符串）
      return { error: '', val: UsdtEle.textContent.replace(' USDT', '') };
    } catch (error: any) {
      return { error: error.message, val: '' };
    }
  });
};

export const checkUnknownModal = async (tab: chrome.tabs.Tab) =>
  await callChromeJs(tab, [], () => {
    try {
      const modal = document.querySelector(`div[role='dialog'][class='bn-modal-wrap data-size-small']`);
      if (modal) throw new Error('未知弹窗，刷新页面, 请确认页面是否正确');
      return { error: '', val: true };
    } catch (error: any) {
      return { error: error.message, val: false };
    }
  });

export const cancelOrder = async (tab: chrome.tabs.Tab) =>
  await callChromeJs(tab, [], async () => {
    // 检测是否有订单
    const cancelAll = document.querySelector(
      '#bn-tab-pane-orderOrder th[aria-colindex="9"] div[class="text-TextLink cursor-pointer"]',
    ) as HTMLButtonElement;
    console.log('cancelAll', cancelAll);
    // 如果不存在则代表未有订单
    if (cancelAll) {
      cancelAll.click();
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    return { error: '', val: true };
  });
