declare global {
  interface Window {
    setInputValue(selector: string, value: string): void;
  }
}

// 获取价格
export const getPrice = async (tab: chrome.tabs.Tab, type: 'Buy' | 'Sell') => {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    args: [type],
    world: 'MAIN',
    func: async type => {
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
    world: 'MAIN',
    args: [price],
    func: price => {
      try {
        window.setInputValue('input#limitPrice', price);
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
    world: 'MAIN',
    func: async () => {
      try {
        const buyPanel = document.querySelector('.bn-tab__buySell[aria-controls="bn-tab-pane-0"]') as HTMLButtonElement;
        if (!buyPanel) {
          throw new Error('买入面板元素不存在, 请确认页面是否正确');
        }
        buyPanel.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        const UsdtEle = document.querySelector(
          '.flexlayout__tab[data-layout-path="/r1/ts0/t0"] .t-caption1 div[class~="text-PrimaryText"]',
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
    world: 'MAIN',
    args: [amount],
    func: amount => {
      try {
        window.setInputValue('input#limitTotal', amount.toString());
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
    world: 'MAIN',
    func: () => {
      try {
        const btn = document.querySelector(
          '.flexlayout__tab[data-layout-path="/r1/ts0/t0"] button[class="bn-button bn-button__buy data-size-middle w-full"]',
        ) as HTMLButtonElement;
        if (!btn) {
          throw new Error('买入按钮不存在, 刷新页面, 请确认页面是否正确');
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
    world: 'MAIN',
    func: async () => {
      try {
        let count = 0;
        // 1000 / 30 每秒30fps 最多等待3秒
        while (count < 100) {
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
    world: 'MAIN',
    func: () => {
      try {
        const btn = document.querySelector(
          '.flexlayout__tab[data-layout-path="/r1/ts0/t0"] .bn-checkbox',
        ) as HTMLButtonElement;
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
    world: 'MAIN',
    args: [price],
    func: price => {
      try {
        const limitTotals = document.querySelectorAll('input#limitTotal');
        if (!limitTotals.length || limitTotals.length < 2) throw new Error('反向价格元素不存在, 请确认页面是否正确');
        const limitTotal = limitTotals[1] as any;
        window.setInputValue(limitTotal, price);
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

// 校验订单 反向模式
export const checkOrder = async (tab: chrome.tabs.Tab, timeout: number = 3000) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    world: 'MAIN',
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
          const buy = document.querySelector('#bn-tab-pane-orderOrder td div[style="color: var(--color-Buy);"]');
          const sell = document.querySelector('#bn-tab-pane-orderOrder td div[style="color: var(--color-Sell);"]');
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
        const buy = document.querySelector('#bn-tab-pane-orderOrder td div[style="color: var(--color-Buy);"]');
        if (buy) {
          const evt = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          const svg = buy.parentNode!.parentNode!.querySelector('svg');
          if (svg) {
            svg.dispatchEvent(evt);
          } else {
            throw new Error('买入订单取消失败，请检查页面是否正确');
          }
          throw new Error('买入订单超时，请检查页面是否正确');
        }
        let loop = true;
        // 如果是卖出订单 赶紧操作补救重新出售
        let sell = document.querySelector('#bn-tab-pane-orderOrder td div[style="color: var(--color-Sell);"]');
        if (!sell) {
          loop = false;
        }
        while (loop) {
          const evt = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          // 取消卖出订单
          const svg = sell!.parentNode!.parentNode!.querySelector('svg');
          if (svg) {
            svg.dispatchEvent(evt);
          } else {
            throw new Error('卖出订单取消失败，请检查页面是否正确');
          }
          await new Promise(resolve => setTimeout(resolve, 1500));
          // 跳转卖出面板
          const sellPanel = document.querySelector(
            '.bn-tab__buySell[aria-controls="bn-tab-pane-1"]',
          ) as HTMLButtonElement;
          if (!sellPanel) {
            throw new Error('卖出面板元素不存在, 刷新页面, 请确认页面是否正确');
          }
          sellPanel.click();
          await new Promise(resolve => setTimeout(resolve, 500));
          sellPanel.click();
          await new Promise(resolve => setTimeout(resolve, 500));
          // 关闭反向订单
          const btn = document.querySelector(
            '.flexlayout__tab[data-layout-path="/r1/ts0/t0"] .bn-checkbox',
          ) as HTMLButtonElement;
          if (!btn) throw new Error('操作卖出补救反向订单按钮不存在, 刷新页面, 请确认页面是否正确');
          // 获取aria-checked是否是true
          const isChecked = btn.getAttribute('aria-checked') === 'true';
          // 点击反向按钮
          if (isChecked) {
            btn.click();
          }

          // 获取卖出价格
          const priceEl = document.querySelector(`.ReactVirtualized__List [style*="--color-Sell"]`) as HTMLSpanElement;
          if (!priceEl) throw new Error('价格元素不存在, 请确认页面是否正确');
          const price = priceEl.textContent.trim();

          // 设置卖出价格
          window.setInputValue('input#limitPrice', price);
          // 设置金额
          let sider_count = 0;
          while (true) {
            const sider = document.querySelector(
              '.flexlayout__tab[data-layout-path="/r1/ts0/t0"] input[type="range"]',
            ) as HTMLInputElement;
            if (!sider) throw new Error('补救卖出面板滑块不存在, 请确认页面是否正确');
            window.setInputValue('.flexlayout__tab[data-layout-path="/r1/ts0/t0"] input[type="range"]', '100');
            await new Promise(resolve => setTimeout(resolve, 16));
            sider_count++;
            if (Number(sider.value) < 80 && sider_count > 3) {
              throw new Error('金额设置异常，请检查页面是否正确');
            } else {
              break;
            }
          }
          // 确认卖出
          const submitBtn = document.querySelector(
            '.flexlayout__tab[data-layout-path="/r1/ts0/t0"] button',
          ) as HTMLButtonElement;
          if (!submitBtn) throw new Error('补救卖出面板提交按钮不存在, 请确认页面是否正确');
          submitBtn.click();
          await new Promise(resolve => setTimeout(resolve, 1500));
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
          await new Promise(resolve => setTimeout(resolve, 1500));
          // 再次校验是否还有卖出订单
          sell = document.querySelector('#bn-tab-pane-orderOrder td div[style="color: var(--color-Sell);"]');
          if (!sell) {
            // 回到买入面板
            const buyPanel = document.querySelector(
              '.bn-tab__buySell[aria-controls="bn-tab-pane-0"]',
            ) as HTMLButtonElement;
            if (!buyPanel) {
              throw new Error('买入面板元素不存在, 请确认页面是否正确');
            }
            buyPanel.click();
            loop = false;
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
    world: 'MAIN',
    func: () => {
      try {
        const container = document.querySelector('.flexlayout__tab[data-layout-path="/r1/ts0/t0"] > div');

        if (container) {
          // 随机滚动到顶部或底部
          const toTop = Math.random() > 0.5;
          container.scrollTop = toTop ? 0 : container.scrollHeight;

          // 定义可能触发的事件
          const events = ['mouseover', 'mousedown', 'mouseup', 'click'];
          const eventType = events[Math.floor(Math.random() * events.length)];

          // 构造并触发事件
          const event = new MouseEvent(eventType, {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          container.dispatchEvent(event);
        }

        const elem = Array.from(
          document
            .querySelector('.order-4 .ReactVirtualized__Grid .ReactVirtualized__Grid__innerScrollContainer')
            ?.querySelectorAll('& > div') ?? [],
        ) as HTMLDivElement[];
        // 取出前面8条数据，如果存在3条以上红色价格连续则抛出异常
        const slicing = elem.slice(0, 10);

        // 判断如果存在连续红线 并且价格是越来越低则抛出异常
        let consecutivePrices: number[] = [];

        for (const e of slicing) {
          const isSell = !!e.querySelector('div[style="color: var(--color-Sell);"]');

          if (isSell) {
            const priceEl = e.querySelector('.flex-1.cursor-pointer');
            const price = parseFloat(priceEl?.textContent?.trim() ?? '0');

            // 添加到连续红线队列
            consecutivePrices.push(price);

            // 只保留最近 3 个
            if (consecutivePrices.length > 3) {
              consecutivePrices.shift();
            }

            // 如果连续满3个 并且严格递减 -> 抛异常
            if (
              consecutivePrices.length === 3 &&
              consecutivePrices[0] > consecutivePrices[1] &&
              consecutivePrices[1] > consecutivePrices[2]
            ) {
              throw new Error('出现连续3个递减的卖出价格，请检查页面是否正确');
            }
          } else {
            // 遇到非红线就清空
            consecutivePrices = [];
          }
        }

        // 如果有连续的三个红色sell则抛出异常
        // const sells = slicing.filter(e => e.querySelector('div[style="color: var(--color-Sell);"]')).slice(0, 3);
        // if (sells.length < 3) {
        //   return { error: '' };
        // }

        // const prices: number[] = [];

        // for (const e of slicing) {
        //   const isSell = !!e.querySelector('div[style="color: var(--color-Sell);"]');
        //   if (isSell) {
        //     const priceEl = e.querySelector('.flex-1.cursor-pointer');
        //     const price = parseFloat(priceEl?.textContent?.replace(/,/g, '').trim() ?? '0');
        //     prices.push(price);
        //   }
        // }

        // if (prices.length > 0) {
        //   const maxPrice = Math.max(...prices);
        //   const minPrice = Math.min(...prices);

        //   // 跌幅 = (最高 - 最低) / 最高 * 100
        //   const dropPercent = ((maxPrice - minPrice) / maxPrice) * 100;

        //   if (dropPercent > 0.1) {
        //     throw new Error(`10 个卖出价格内出现下跌超过 0.1%（跌幅 ${dropPercent.toFixed(4)}%） ${prices}`);
        //   }
        // }

        return { error: '' };

        // const prices = sells.map(e => {
        //   const priceEl = e.querySelector('.flex-1.cursor-pointer');
        //   return parseFloat(priceEl?.textContent?.trim() ?? '0');
        // });
        // const maxPrice = Math.max(...prices);
        // const minPrice = Math.min(...prices);
        // const diffPercent = ((maxPrice - minPrice) / minPrice) * 100;
        // if (diffPercent > 0.1) {
        //   return { error: '波动超过 0.1%' };
        // } else {
        //   return { error: '' };
        // }
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

// 跳转下单 卖出
export const goToSell = async (
  tab: chrome.tabs.Tab,
  reverse: boolean = false,
  lastPrice = '',
): Promise<{
  isSell: string;
  price: string;
}> => {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    args: [reverse, lastPrice],
    world: 'MAIN',
    func: async (reverse, lastPrice: string) => {
      try {
        const container = document.querySelector('.flexlayout__tab[data-layout-path="/r1/ts0/t0"] > div');

        console.log('container', container);
        if (container) {
          // 随机滚动到顶部或底部
          const toTop = Math.random() > 0.5;
          container.scrollTop = toTop ? 0 : container.scrollHeight;

          // 定义可能触发的事件
          const events = ['mouseover', 'mousedown', 'mouseup', 'click'];
          const eventType = events[Math.floor(Math.random() * events.length)];

          // 构造并触发事件
          const event = new MouseEvent(eventType, {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          container.dispatchEvent(event);
        }

        let val = '';
        const sellPanel = document.querySelector(
          '.bn-tab__buySell[aria-controls="bn-tab-pane-1"]',
        ) as HTMLButtonElement;
        if (!sellPanel) {
          throw new Error('卖出面板元素不存在, 请确认页面是否正确');
        }
        sellPanel.click();
        await new Promise(resolve => setTimeout(resolve, 300));
        sellPanel.click();
        await new Promise(resolve => setTimeout(resolve, 300));

        // 关闭反向订单
        const btn = document.querySelector(
          '.flexlayout__tab[data-layout-path="/r1/ts0/t0"] .bn-checkbox',
        ) as HTMLButtonElement;
        if (btn) {
          // if (!btn) throw new Error('操作卖出反向订单按钮不存在, 请确认页面是否正确');
          // 获取aria-checked是否是true
          const isChecked = btn.getAttribute('aria-checked') === 'true';
          // 点击反向按钮
          if (isChecked) {
            btn.click();
          }
        }
        const priceEl = document.querySelector(
          `.ReactVirtualized__List [style*="--color-${reverse ? 'Sell' : 'Buy'}"]`,
        ) as HTMLSpanElement;
        if (!priceEl) throw new Error('价格元素不存在, 请确认页面是否正确');
        let sellPrice = priceEl.textContent.trim();
        if (lastPrice && parseFloat(lastPrice) > parseFloat(sellPrice)) {
          // return { error: '', val: '-1' };
          val = '-1';
          sellPrice = lastPrice;
        } else {
          val = sellPrice;
        }
        // 设置卖出价格
        window.setInputValue('input#limitPrice', sellPrice);
        // 设置金额
        let sider_count = 0;
        while (true) {
          const sider = document.querySelector(
            '.flexlayout__tab[data-layout-path="/r1/ts0/t0"] input[type="range"]',
          ) as any;
          if (!sider) throw new Error('卖出面板滑块不存在, 请确认页面是否正确');
          window.setInputValue('.flexlayout__tab[data-layout-path="/r1/ts0/t0"] input[type="range"]', '100');
          await new Promise(resolve => setTimeout(resolve, 16));
          sider_count++;
          if (sider.value < 10 && sider_count > 3) {
            throw new Error('金额设置异常，请检查页面是否正确');
          } else {
            break;
          }
        }
        // 执行卖出
        const submitBtn = document.querySelector(
          '.flexlayout__tab[data-layout-path="/r1/ts0/t0"] button',
        ) as HTMLButtonElement;
        if (!submitBtn) throw new Error('卖出面板提交按钮不存在, 请确认页面是否正确');
        submitBtn.click();
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
        return { error: '', val: { isSell: val, price: sellPrice } };
      } catch (error) {
        return { error: String(error) };
      }
    },
  });
  const [{ result }] = results;
  if (result?.error) {
    throw new Error(result.error);
  }
  if (result?.val) {
    return result.val;
  }
  return { isSell: '-1', price: '' };
};

// 校验订单 下单模式
export const checkByOrderBuy = async (tab: chrome.tabs.Tab, timeout: number = 3) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    args: [timeout],
    world: 'MAIN',
    func: async timeout => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1100));
        const order = document.querySelector('div[id="bn-tab-orderOrder"]') as HTMLButtonElement;
        if (!order) throw new Error('订单元素不存在, 请确认页面是否正确');
        const limit = document.querySelector('div[id="bn-tab-limit"]') as HTMLButtonElement;
        if (!limit) throw new Error('限价元素不存在, 请确认页面是否正确');
        let count = 0;
        while (true) {
          const buy = document.querySelector('#bn-tab-pane-orderOrder td div[style="color: var(--color-Buy);"]');
          if (!buy) break;
          await new Promise(resolve => setTimeout(resolve, 1000 / 30));
          count++;
          // 大约 33 * timeout = timeout s 后超时
          if (count > 33 * timeout) {
            console.error('订单超时，请检查页面是否正确');
            break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 1100));
        // 取消买入订单
        const buy = document.querySelector('#bn-tab-pane-orderOrder td div[style="color: var(--color-Buy);"]');
        console.log('buy???', buy);
        if (buy) {
          const evt = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          const svg = buy.parentNode!.parentNode!.querySelector('svg');
          if (svg) {
            svg.dispatchEvent(evt);
          } else {
            throw new Error('买入订单取消失败，请检查页面是否正确');
          }
          await new Promise(resolve => setTimeout(resolve, 1500));
          throw new Error('买入订单超时，请检查页面是否正确');
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

// #TODO 如果止损价格跌出0.1% 则取消订单加速卖出
export const checkByOrderSell = async (tab: chrome.tabs.Tab, timeout: number = 3) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    args: [timeout],
    world: 'MAIN',
    func: async timeout => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        let count = 0;
        while (true) {
          const sell = document.querySelector('#bn-tab-pane-orderOrder td div[style="color: var(--color-Sell);"]');
          if (!sell) break;
          await new Promise(resolve => setTimeout(resolve, 1000 / 30));
          count++;
          // 大约 33 * timeout = timeout s 后超时
          if (count > 33 * timeout) {
            console.error(`订单超时 ${count + 1}次`);
            break;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1500));

        // 没有卖出 取消
        const sell = document.querySelector('#bn-tab-pane-orderOrder td div[style="color: var(--color-Sell);"]');
        if (sell) {
          const evt = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          const svg = sell.parentNode!.parentNode!.querySelector('svg');
          if (svg) {
            svg.dispatchEvent(evt);
          } else {
            throw new Error('卖出订单取消失败，请检查页面是否正确');
          }
          await new Promise(resolve => setTimeout(resolve, 1500));
          throw new Error('卖出订单超时，请检查页面是否正确');
        }
        return { error: '' };
      } catch (error) {
        return { error: String(error) };
      }
    },
  });

  const [{ result }] = results;
  if (result?.error) {
    throw new Error(result.error);
  }
  return result;
};

export const cancelOrder = async (tab: chrome.tabs.Tab) => {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    world: 'MAIN',
    func: async () => {
      const sell = document.querySelector('#bn-tab-pane-orderOrder td div[style="color: var(--color-Sell);"]');
      if (sell) {
        const evt = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        const svg = sell.parentNode!.parentNode!.querySelector('svg');
        if (svg) {
          svg.dispatchEvent(evt);
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      const buy = document.querySelector('#bn-tab-pane-orderOrder td div[style="color: var(--color-Buy);"]');
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
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    },
  });
};

export const getIsSell = async (tab: chrome.tabs.Tab) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    world: 'MAIN',
    func: async () => {
      try {
        const sellPanel = document.querySelector(
          '.bn-tab__buySell[aria-controls="bn-tab-pane-1"]',
        ) as HTMLButtonElement;
        if (!sellPanel) {
          throw new Error('卖出面板元素不存在, 请确认页面是否正确');
        }
        sellPanel.click();
        await new Promise(resolve => setTimeout(resolve, 300));
        sellPanel.click();
        await new Promise(resolve => setTimeout(resolve, 300));
        const priceEl = document.querySelector(`.ReactVirtualized__List [style*="--color-Sell"]`) as HTMLSpanElement;
        if (!priceEl) throw new Error('价格元素不存在, 请确认页面是否正确');
        const sellPrice = priceEl.textContent.trim();
        // 设置卖出价格
        window.setInputValue('input#limitPrice', sellPrice);
        await new Promise(resolve => setTimeout(resolve, 16));
        // 设置金额
        const sider = document.querySelector(
          '.flexlayout__tab[data-layout-path="/r1/ts0/t0"] input[type="range"]',
        ) as HTMLInputElement;
        if (!sider) throw new Error('卖出面板滑块不存在, 请确认页面是否正确');
        window.setInputValue('.flexlayout__tab[data-layout-path="/r1/ts0/t0"] input[type="range"]', '100');
        await new Promise(resolve => setTimeout(resolve, 16));
        const error = document.querySelector('div.bn-textField__line.data-error')?.querySelector('#limitTotal');
        if (error) {
          return { error: '', val: true };
        }
        if (Number(sider.value) >= 80) {
          return { error: '', val: true };
        }
        return { error: '', val: false };
      } catch (error) {
        return { error: String(error) };
      }
    },
  });
  const [{ result }] = results;
  if (result?.error) {
    throw new Error(result.error);
  }
  if (result?.val) {
    return result.val;
  }
  return false;
};

export const checkAmount = async (tab: chrome.tabs.Tab) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    world: 'MAIN',
    func: async () => {
      try {
        const sellPanel = document.querySelector(
          '.bn-tab__buySell[aria-controls="bn-tab-pane-1"]',
        ) as HTMLButtonElement;
        if (!sellPanel) {
          throw new Error('卖出面板元素不存在, 请确认页面是否正确');
        }
        sellPanel.click();
        await new Promise(resolve => setTimeout(resolve, 300));
        sellPanel.click();
        await new Promise(resolve => setTimeout(resolve, 300));
        const hasError = document.querySelector('.flexlayout__tab[data-layout-path="/r1/ts0/t0"] .text-Error');
        if (hasError && hasError.textContent === '超过可用余额') {
          return { error: '超过可用余额, 刷新页面，请检查页面是否正确', val: true };
        }
        return { error: '', val: false };
      } catch (error) {
        return { error: String(error) };
      }
    },
  });
  const [{ result }] = results;
  if (result?.error) {
    throw new Error(result.error);
  }
  if (result?.val) {
    return result.val;
  }
  return false;
};

export const checkUnknownModal = async (tab: chrome.tabs.Tab) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    world: 'MAIN',
    func: () => {
      try {
        const modal = document.querySelector(`div[role='dialog'][class='bn-modal-wrap data-size-small']`);
        if (modal) throw new Error('未知弹窗，刷新页面, 请确认页面是否正确');
        return { error: '' };
      } catch (error) {
        return { error: String(error) };
      }
    },
  });
  const [{ result }] = results;
  if (result?.error) {
    throw new Error(result.error);
  }
};

export const getCode = (secret: string) => (window as any).otplib.authenticator.generate(secret);

// 获取是否出现验证码弹窗
export const checkAuthModal = async (tab: chrome.tabs.Tab, secret: string) => {
  const isModal = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => {
      const dialog = document.querySelector('#mfa-shadow-host');
      if (dialog) {
        return true;
      }
      return false;
    },
  });
  const [{ result }] = isModal;
  if (result) {
    if (!secret) throw new Error('出现验证码，但是未设置，自动停止');
    const code = getCode(secret);
    if (!code) throw new Error('出现验证码，但获取验证码失败，自动停止');
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      args: [code],
      func: async (code: string) => {
        try {
          const dialog = document.querySelector('#mfa-shadow-host');
          if (dialog) {
            const root = dialog.shadowRoot;
            if (!root) throw new Error('验证失败，自动停止');
            // 获取是否生物验证
            if (root.querySelector('.mfa-security-page-title')?.textContent === '通过通行密钥验证') {
              const btn = root.querySelector('.bidscls-btnLink2') as HTMLButtonElement;
              if (btn) {
                // 跳转二次验证
                btn.click();
              }
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            const steps = root.querySelectorAll('.bn-mfa-overview-step-title');
            const sfzapp = Array.from(steps).find(c => c.innerHTML.includes('身份验证')) as HTMLButtonElement;
            if (sfzapp) {
              sfzapp.click();
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            // 判断是否是身份验证器
            const checkText = root.querySelector('.bn-formItem-label')?.textContent;
            console.log('通过验证码');
            if (checkText === '身份验证器App') {
              // 查找input
              const input = root.querySelector('.bn-textField-input') as any;
              const value = code;

              const nativeInputValueSetter = (Object as any).getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value',
              ).set;

              nativeInputValueSetter.call(input, value);

              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              await new Promise(resolve => setTimeout(resolve, 5000));
              const dialog = document.querySelector('#mfa-shadow-host');
              if (dialog) {
                window.location.reload();
              }
            }
          }
          return { error: '' };
        } catch (error) {
          return { error: String(error) };
        }
      },
    });
    const [{ result: result2 }] = results;
    if (result2?.error) {
      throw new Error(result2?.error);
    }
    return true;
  }
  return false;
};

export let loop = false;

export const stopLoopAuth = async () => {
  loop = false;
};

export const startLoopAuth = async (tab: chrome.tabs.Tab, secret: string, callback: (stop: boolean) => void) => {
  loop = true;
  console.log('startLoopAuth');
  while (loop) {
    console.log('二次验证码检测中...');
    await new Promise(resolve => setTimeout(resolve, 300));
    await checkAuthModal(tab, secret).catch((err: { message: string }) => {
      console.error('startLoopAuth', err.message);
      if (err.message.includes('停止')) {
        callback(true);
      }
    });
  }
};
