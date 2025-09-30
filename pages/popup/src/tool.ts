// 获取价格
export const getPrice = async (tab: chrome.tabs.Tab, type: 'Buy' | 'Sell') => {
  // const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    args: [type],
    func: type => {
      try {
        const priceEl = document.querySelector(`.ReactVirtualized__List [style*="--color-${type}"]`) as HTMLSpanElement;
        if (!priceEl) throw new Error('价格元素不存在, 请确认页面是否正确');
        // 返回价格（字符串）
        // return priceEl.textContent.trim();
        return { error: '', val: priceEl.textContent.trim() };
      } catch (err) {
        return { error: String(err) };
      }
    },
  });

  const [{ result }] = results;
  if (result?.error) {
    throw new Error(result.error);
  }
  return result?.val ?? '';
};

// 设置价格
export const setPrice = async (tab: chrome.tabs.Tab, price: string) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    args: [price],
    func: price => {
      try {
        const limitPrice = document.querySelector('input#limitPrice') as any;
        if (!limitPrice) throw new Error('成交价格元素不存在, 请确认页面是否正确');
        const lastValue = limitPrice.value;
        limitPrice.value = price;
        const tracker1 = limitPrice._valueTracker;
        if (tracker1) {
          tracker1.setValue(lastValue);
        }
        limitPrice.dispatchEvent(new Event('input', { bubbles: true }));
        limitPrice.dispatchEvent(new Event('change', { bubbles: true }));

        return { error: '' };
      } catch (err) {
        return { error: String(err) };
      }
    },
  });

  const [{ result }] = results;
  if (result?.error) {
    throw new Error(result.error);
  }
  return result;
};

// 获取余额
export const getBalance = async (tab: chrome.tabs.Tab) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => {
      try {
        const UsdtEle = document.querySelector(
          "div[class='text-PrimaryText text-[12px] leading-[18px] font-[500]']",
        ) as HTMLSpanElement;
        if (!UsdtEle) throw new Error('获取不到余额, 请确认页面是否正确');
        // 返回余额（字符串）
        return { error: '', val: UsdtEle.textContent.replace(' USDT', '') };
      } catch (err) {
        return { error: String(err) };
      }
    },
  });

  const [{ result }] = results;
  if (result?.error) {
    throw new Error(result.error);
  }
  return result?.val ?? '';
};

// 设置买入金额
export const setAmount = async (tab: chrome.tabs.Tab, amount: number) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    args: [amount],
    func: amount => {
      try {
        const limitTotal = document.querySelector('input#limitTotal') as any;
        if (!limitTotal) throw new Error('limitTotal元素不存在, 请确认页面是否正确');
        const lastValue = limitTotal.value;
        limitTotal.value = amount;
        const tracker1 = limitTotal._valueTracker;
        if (tracker1) {
          tracker1.setValue(lastValue);
        }
        limitTotal.dispatchEvent(new Event('input', { bubbles: true }));
        limitTotal.dispatchEvent(new Event('change', { bubbles: true }));
        return { error: '' };
      } catch (err) {
        return { error: String(err) };
      }
    },
  });

  const [{ result }] = results;
  if (result?.error) {
    throw new Error(result.error);
  }
  return result;
};

// 操作买入
export const triggerBuy = async (tab: chrome.tabs.Tab) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => {
      try {
        const btn = document.querySelector(
          '.order-5 button[class="bn-button bn-button__buy data-size-middle w-full"]',
        ) as HTMLButtonElement;
        if (!btn) {
          throw new Error('买入按钮不存在, 请确认页面是否正确');
        }
        btn.click();
        return { error: '' };
      } catch (err) {
        return { error: String(err) };
      }
    },
  });

  const [{ result }] = results;
  if (result?.error) {
    throw new Error(result.error);
  }
  return result;
};

// 校验买入
export const checkBuy = async (tab: chrome.tabs.Tab) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: async () => {
      try {
        let count = 0;
        // 1000 / 30 每秒30fps 最多等待1秒
        while (count < 32) {
          await new Promise(resolve => setTimeout(resolve, 1000 / 30));
          const btn = document
            .querySelector(`div[role='dialog'][class='bn-modal-wrap data-size-small']`)
            ?.querySelector('.bn-button__primary') as HTMLButtonElement;
          if (btn) {
            btn.click();
            break;
          }
          count++;
        }
        return { error: '' };
      } catch (err) {
        return { error: String(err) };
      }
    },
  });

  const [{ result }] = results;
  if (result?.error) {
    throw new Error(result.error);
  }
  return result;
};

// 校验反向订单
export const checkReverseOrder = async (tab: chrome.tabs.Tab) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => {
      try {
        const btn = document.querySelector('.order-5 .bn-checkbox') as HTMLButtonElement;
        if (!btn) throw new Error('反向订单按钮不存在, 请确认页面是否正确');
        // 获取aria-checked是否是true
        const isChecked = btn.getAttribute('aria-checked') === 'true';
        // 点击反向按钮
        if (!isChecked) {
          btn.click();
        }
        return { error: '' };
      } catch (err) {
        return { error: String(err) };
      }
    },
  });

  const [{ result }] = results;
  if (result?.error) {
    throw new Error(result.error);
  }
  return result;
};

// 设置反向订单价格
export const setReversePrice = async (tab: chrome.tabs.Tab, price: string) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    args: [price],
    func: price => {
      try {
        const limitTotals = document.querySelectorAll('input#limitTotal');
        if (!limitTotals.length || limitTotals.length < 2) throw new Error('反向价格元素不存在, 请确认页面是否正确');
        const limitTotal = limitTotals[1] as any;
        const lastValue = limitTotal.value;
        limitTotal.value = price;
        const tracker1 = limitTotal._valueTracker;
        if (tracker1) {
          tracker1.setValue(lastValue);
        }
        limitTotal.dispatchEvent(new Event('input', { bubbles: true }));
        limitTotal.dispatchEvent(new Event('change', { bubbles: true }));
        return { error: '' };
      } catch (err) {
        return { error: String(err) };
      }
    },
  });

  const [{ result }] = results;
  if (result?.error) {
    throw new Error(result.error);
  }
  return result;
};

// 设置订单
export const checkOrder = async (tab: chrome.tabs.Tab, timeout: number = 3000) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    args: [timeout],
    func: async timeout => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const order = document.querySelector('div[id="bn-tab-orderOrder"]') as HTMLButtonElement;
        if (!order) throw new Error('订单元素不存在, 请确认页面是否正确');
        const limit = document.querySelector('div[id="bn-tab-limit"]') as HTMLButtonElement;
        if (!limit) throw new Error('限价元素不存在, 请确认页面是否正确');
        let count = 0;
        while (true) {
          const buy = document.querySelector('td div[style="color: var(--color-Buy);"]');
          const sell = document.querySelector('td div[style="color: var(--color-Sell);"]');
          if (!buy && !sell) break;
          await new Promise(resolve => setTimeout(resolve, 1000 / 30));
          count++;
          // 大约 33 * timeout = timeout s 后超时
          if (count > 33 * timeout) {
            console.error('订单超时，请检查页面是否正确');
            break;
          }
        }
        // 如果是买入订单赶紧取消
        const buy = document.querySelector('td div[style="color: var(--color-Buy);"]');
        if (buy) {
          const evt = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          const svg = buy.parentNode!.parentNode!.querySelector('svg');
          if (svg) {
            svg.dispatchEvent(evt);
          }
          throw new Error('买入订单超时，请检查页面是否正确');
        }
        // TODO：如果是卖出订单 赶紧操作补救重新出售
        let sell = document.querySelector('td div[style="color: var(--color-Sell);"]');
        while (sell) {
          const evt = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          // 取消卖出订单
          const svg = sell.parentNode!.parentNode!.querySelector('svg');
          if (svg) {
            svg.dispatchEvent(evt);
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          // 跳转卖出面板
          const sellPanel = document.querySelector(
            '.bn-tab__buySell[aria-controls="bn-tab-pane-1"]',
          ) as HTMLButtonElement;
          if (!sellPanel) {
            throw new Error('卖出面板元素不存在, 请确认页面是否正确');
          }
          sellPanel.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          // 关闭反向订单
          const btn = document.querySelector('.order-5 .bn-checkbox') as HTMLButtonElement;
          if (!btn) throw new Error('操作卖出补救反向订单按钮不存在, 请确认页面是否正确');
          // 获取aria-checked是否是true
          const isChecked = btn.getAttribute('aria-checked') === 'true';
          // 点击反向按钮
          if (isChecked) {
            btn.click();
          }
          // 设置金额
          const sider = document.querySelector('.order-5 input[type="range"]') as any;
          if (!sider) throw new Error('补救卖出面板滑块不存在, 请确认页面是否正确');
          const lastValue = sider.value;
          sider.value = '100';
          const tracker1 = sider._valueTracker;
          if (tracker1) {
            tracker1.setValue(lastValue);
          }
          sider.dispatchEvent(new Event('input', { bubbles: true }));
          sider.dispatchEvent(new Event('change', { bubbles: true }));

          // 获取卖出价格
          const priceEl = document.querySelector(`.ReactVirtualized__List [style*="--color-Sell"]`) as HTMLSpanElement;
          if (!priceEl) throw new Error('价格元素不存在, 请确认页面是否正确');
          const price = priceEl.textContent.trim();

          // 设置卖出价格
          const limitPrice = document.querySelector('input#limitPrice') as any;
          if (!limitPrice) throw new Error('成交价格元素不存在, 请确认页面是否正确');
          const lastValue1 = limitPrice.value;
          limitPrice.value = price;
          const tracker2 = limitPrice._valueTracker;
          if (tracker2) {
            tracker2.setValue(lastValue1);
          }
          limitPrice.dispatchEvent(new Event('input', { bubbles: true }));
          limitPrice.dispatchEvent(new Event('change', { bubbles: true }));

          // 确认卖出
          const submitBtn = document.querySelector('.order-5 button') as HTMLButtonElement;
          if (!submitBtn) throw new Error('补救卖出面板提交按钮不存在, 请确认页面是否正确');
          submitBtn.click();
          await new Promise(resolve => setTimeout(resolve, 300));
          // 校验卖出
          let count = 0;
          // 1000 / 30 每秒30fps 最多等待1秒
          while (count < 32) {
            await new Promise(resolve => setTimeout(resolve, 1000 / 30));
            const btn = document
              .querySelector(`div[role='dialog'][class='bn-modal-wrap data-size-small']`)
              ?.querySelector('.bn-button__primary') as HTMLButtonElement;
            if (btn) {
              btn.click();
              break;
            }
            count++;
          }
          // 等待3秒后再次检测
          await new Promise(resolve => setTimeout(resolve, 3000));
          // 再次校验是否还有卖出订单
          sell = document.querySelector('td div[style="color: var(--color-Sell);"]');
          if (!sell) {
            // 回到买入面板
            const buyPanel = document.querySelector(
              '.bn-tab__buySell[aria-controls="bn-tab-pane-0"]',
            ) as HTMLButtonElement;
            if (!buyPanel) {
              throw new Error('买入面板元素不存在, 请确认页面是否正确');
            }
            buyPanel.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        return { error: '' };
      } catch (err) {
        return { error: String(err) };
      }
    },
  });

  const [{ result }] = results;
  if (result?.error) {
    throw new Error(result.error);
  }
  return result;
};

// 防抖动检测
export const checkWaterfall = async (tab: chrome.tabs.Tab) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => {
      try {
        const elem = Array.from(
          document
            .querySelector('.order-4 .ReactVirtualized__Grid .ReactVirtualized__Grid__innerScrollContainer')
            ?.querySelectorAll('& > div') ?? [],
        ) as HTMLDivElement[];
        // 取出前面8条数据，如果存在3条以上红色价格连续则抛出异常
        const slicing = elem.slice(0, 8);
        const sells = slicing.filter(e => e.querySelector('div[style="color: var(--color-Sell);"]')).slice(0, 3);
        if (sells.length < 3) {
          return { error: '' };
        }
        // flex-1 cursor-pointer 获取价格 如果全部一致则不算波动
        const prices = sells
          .map(e => {
            const priceEl = e.querySelector('.flex-1.cursor-pointer');
            return priceEl?.textContent?.trim();
          })
          .filter(Boolean);
        const allSame = prices.every(p => p === prices[0]);
        if (!allSame) {
          throw new Error('价格波动异常，放弃下单');
        }
        return { error: '' };
      } catch (err) {
        return { error: String(err) };
      }
    },
  });

  const [{ result }] = results;
  if (result?.error) {
    throw new Error(result.error);
  }
  return result;
};
