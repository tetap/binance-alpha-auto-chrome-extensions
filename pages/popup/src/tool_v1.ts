import { getIsSell } from './tool';

declare global {
  interface Window {
    setInputValue: (selector: string, value: string) => void;
  }
}

export const callChromeJs = async <T, A extends any[] = []>(
  tab: chrome.tabs.Tab,
  func: (...args: A) => { error: string; val: T } | Promise<{ error: string; val: T }>,
  args?: A,
): Promise<T> => {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func,
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
  const name = await callChromeJs(tab, () => {
    try {
      const dom = document.querySelector('.bg-BasicBg .text-PrimaryText');
      return { error: '', val: dom?.textContent.trim() };
    } catch (err: any) {
      return { error: err.message, val: '' };
    }
  });
  if (!name) return '';
  console.log(name);
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

export const jumpToSell = async (tab: chrome.tabs.Tab) =>
  await callChromeJs(tab, async () => {
    try {
      const sellPanel = document.querySelector('.bn-tab__buySell[aria-controls="bn-tab-pane-1"]') as HTMLButtonElement;
      if (!sellPanel) throw new Error('卖出面板元素不存在, 请确认页面是否正确');
      sellPanel.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { error: '', val: true };
    } catch (error: any) {
      return { error: error.message, val: false };
    }
  });

export const setPrice = async (tab: chrome.tabs.Tab, price: string) =>
  await callChromeJs(tab, async () => {
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

      // 设置卖出数量
      window.setInputValue('.flexlayout__tab[data-layout-path="/r1/ts0/t0"] input[type="range"]', '100');
      await new Promise(resolve => setTimeout(resolve, 16));

      return { error: '', val: true };
    } catch (error: any) {
      return { error: error.message, val: false };
    }
  });

export const submitSell = async (tab: chrome.tabs.Tab) =>
  await callChromeJs(tab, async () => {
    try {
      // 确认卖出
      const submitBtn = document.querySelector(
        '.flexlayout__tab[data-layout-path="/r1/ts0/t0"] button',
      ) as HTMLButtonElement;
      if (!submitBtn) throw new Error('提交卖出按钮不存在, 请确认页面是否正确');
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
          return { error: '', val: false };
        }
        count++;
      }
      return { error: '操作卖出超时，刷新页面后重试', val: true };
    } catch (error: any) {
      return { error: error.message, val: true };
    }
  });

export const waitOrder = async (tab: chrome.tabs.Tab, timeout: number = 3) =>
  await callChromeJs(
    tab,
    async timeout => {
      try {
        const start = Date.now();
        while (true) {
          await new Promise(resolve => setTimeout(resolve, 300));
          // 检测是否有订单
          const cancelAll = document.querySelector(
            '#bn-tab-pane-orderOrder th[aria-colindex="9"] div[class="text-TextLink cursor-pointer"]',
          ) as HTMLButtonElement;
          // 如果不存在则代表未有订单
          if (!cancelAll) break;
          // 如果存在 且超时操作取消 并且返回超时 timeout 单位（s）
          if (Date.now() - start > timeout * 1000) {
            cancelAll.click();
            await new Promise(resolve => setTimeout(resolve, 300));
            // 确认弹窗
            const btn = document.querySelector(
              '.bn-modal-confirm .bn-modal-confirm-actions .bn-button__primary',
            ) as HTMLButtonElement;
            if (btn) btn.click();
            return { error: '操作超时，请刷新页面后重试', val: true };
          }
        }
        return { error: '', val: true };
      } catch (error: any) {
        return { error: error.message, val: false };
      }
    },
    [timeout],
  );

export const isAuthModal = async (tab: chrome.tabs.Tab) =>
  await callChromeJs(tab, () => {
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

export const backSell = async (tab: chrome.tabs.Tab, symbol: string, timeout: number = 3) => {
  const isSell = await getIsSell(tab);
  if (!isSell) return;
  await jumpToSell(tab); // 跳转卖出
  const price = await getPrice(symbol); // 获取价格
  if (!price) throw new Error('获取价格失败');
  // 设置卖出价格
  await setPrice(tab, price);
  // 执行卖出
  await submitSell(tab); // 确认卖出
  // 判断是否出现验证码
  const isAuth = await isAuthModal(tab);
  // 出现验证弹窗等待
  if (isAuth) await new Promise(resolve => setTimeout(resolve, 1000));
  // 等待订单
  await waitOrder(tab, timeout);
};
