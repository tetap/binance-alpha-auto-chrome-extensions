import '@src/Popup.css';
import { startLoopAuth, stopLoopAuth } from './tool';
import {
  getIsSell,
  backSell,
  callSubmit,
  detectDropRisk,
  getBalance,
  getId,
  getPrice,
  getPriceList,
  isAuthModal,
  jumpToBuy,
  jumpToSell,
  setLimitTotal,
  setPrice,
  setRangeValue,
  waitOrder,
  cancelOrder,
  checkUnknownModal,
} from './tool_v1';
import { useStorage } from '@extension/shared';
import { bicycleSettingStorage, settingStorage, todayDealStorage } from '@extension/storage';
import { Button, cn, Input, Label, RadioGroup, RadioGroupItem } from '@extension/ui';
import dayjs, { extend } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { floor } from 'lodash-es';
import { useRef } from 'react';

extend(utc);

export interface IOrderModeProps {
  setCurrentBalance: (balance: string) => void;
  startBalance: string;
  setStartBalance: (balance: string) => void;
  runing: boolean;
  setRuning: (runing: boolean) => void;
  appendLog: (msg: string, type: 'success' | 'error' | 'info') => void;
  setNum: (num: number) => void;
}

export const BicycleMode = ({
  setCurrentBalance,
  setStartBalance,
  startBalance,
  runing,
  setRuning,
  appendLog,
  setNum,
}: IOrderModeProps) => {
  const stopRef = useRef(false);
  const orderSetting = useStorage(bicycleSettingStorage);

  const getOptions = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries()) as {
      amount: string;
      count: string;
      runNum: string;
      orderAmountMode: 'Fixed' | 'Random';
      maxAmount: string;
      minAmount: string;
      checkPriceTime: string;
      checkPriceCount: string;
    };

    if (!data.runNum || !data.checkPriceCount || !data.checkPriceTime || !data.count) {
      throw new Error('参数不能为空');
    }
    // 校验amount count dot runNum 是否为数字
    if (
      isNaN(Number(data.runNum)) ||
      isNaN(Number(data.checkPriceCount)) ||
      isNaN(Number(data.checkPriceTime)) ||
      isNaN(Number(data.count))
    ) {
      throw new Error('参数必须为数字');
    }
    // 校验下单金额
    if (data.orderAmountMode === 'Fixed') {
      if (!data.amount) {
        throw new Error('下单金额不能为空');
      }
      if (isNaN(Number(data.amount))) {
        throw new Error('下单金额必须为数字');
      }
    } else if (data.orderAmountMode === 'Random') {
      if (!data.maxAmount || !data.minAmount) {
        throw new Error('下单金额范围不能为空');
      }
      if (isNaN(Number(data.maxAmount)) || isNaN(Number(data.minAmount))) {
        throw new Error('下单金额范围必须为数字');
      }
      if (Number(data.maxAmount) < Number(data.minAmount)) {
        throw new Error('下单金额范围错误');
      }
    } else {
      throw new Error('下单金额模式错误');
    }

    return data;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (runing) return;
    const options = getOptions(e);

    stopRef.current = false;

    setRuning(true);

    const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });

    const symbol = await getId(tab).catch(() => ''); // 获取货币id

    if (!symbol) {
      appendLog('获取货币id失败', 'error');
      setRuning(false);
      return;
    }

    // 二次校验
    const secret = (await settingStorage.get()).secret;
    if (secret) {
      startLoopAuth(tab, secret, () => {
        stopRef.current = true;
        appendLog('出现验证码校验失败，自动停止', 'error');
      });
    }

    const runNum = options.runNum ? Number(options.runNum) : 1; // 运行次数

    const timeout = options.checkPriceTime ? Number(options.checkPriceTime) : 1; // 下单超时时间

    const timeoutCount = options.checkPriceCount ? Number(options.checkPriceCount) : 1; // 下单超时次数

    const count = Number(options.count); // 保守设置

    let balance = await getBalance(tab);

    if (!balance) return console.error('获取余额失败');

    if (!startBalance) {
      setStartBalance(balance);
    }

    for (let i = 0; i < runNum; i++) {
      if (stopRef.current) {
        appendLog(`意外终止`, 'error');
        break;
      }
      appendLog(`当前轮次: ${i + 1}`, 'info');
      try {
        // 等待1s
        await new Promise(resolve => setTimeout(resolve, 1000));
        // 校验是否有未知弹窗
        await checkUnknownModal(tab);
        // 校验是否有未取消的订单
        await cancelOrder(tab);
        // 兜底卖出
        await backSell(tab, symbol, appendLog, timeout);
        // 回到买入面板
        await jumpToBuy(tab);
        // 抖动检测
        const trades = await getPriceList(symbol);
        console.log('trades', trades);
        // 获取抖动窗口
        const priceWindows = detectDropRisk(trades, {
          buyIndex: 0,
          windowMs: 10_000,
          thresholdPct: 0.1,
          volumeWeighted: true,
        });
        appendLog(`价格抖动窗口: 是否买入: ${priceWindows.hasRisk ? '取消' : '买入'};`, 'info');
        appendLog(`价格抖动窗口: 买入价: ${priceWindows.buyPrice};最低价: ${priceWindows.minPrice};`, 'info');
        if (priceWindows.hasRisk) {
          i--;
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }
        let buyPrice = await getPrice(symbol);
        appendLog(`保守设置次数:${count}`, 'info');
        for (let j = 0; j < count; j++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          // 获取买入价
          const curPrice = await getPrice(symbol); // 获取价格
          appendLog(`当前价格：${curPrice}`, 'info');
          if (Number(curPrice) < Number(buyPrice)) {
            buyPrice = curPrice;
            appendLog(`价格下跌，调整买入价为${buyPrice}`, 'info');
          }
        }
        if (!buyPrice) throw new Error('获取价格失败');
        appendLog(`获取到买入价格: ${buyPrice}`, 'info');
        // 操作写入买入价格
        await setPrice(tab, buyPrice);
        // 计算买入金额
        const amount =
          options.orderAmountMode === 'Fixed'
            ? options.amount
            : floor(
                (Number(options.maxAmount) - Number(options.minAmount)) * Math.random() + Number(options.minAmount),
                2,
              ).toString();
        // 设置买入金额
        await setLimitTotal(tab, amount);

        const checkPrice = await getPrice(symbol); // 获取价格

        if (Number(checkPrice) < Number(buyPrice)) {
          appendLog(`价格${buyPrice}下滑到${checkPrice}，休息一会儿`, 'error');
          await new Promise(resolve => setTimeout(resolve, 6000));
          throw new Error(`价格${buyPrice}下滑到${checkPrice}，停止买入`);
        }

        // 操作确认买入
        await callSubmit(tab);
        // 判断是否出现验证码
        const isAuth = await isAuthModal(tab);
        // 出现验证弹窗等待
        if (isAuth) {
          appendLog('出现验证码等待过验证', 'info');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        // 等待订单完成
        await waitOrder(tab, timeout);

        appendLog(`下单成功: 价格： ${buyPrice} 金额：${amount}`, 'success');

        const day = dayjs().utc().format('YYYY-MM-DD');

        todayDealStorage.setVal(day, amount);

        // 卖出
        await jumpToSell(tab);
        let sellCount = 0;
        let isSuccess = false;
        while (sellCount < timeoutCount) {
          let submitPrice = buyPrice;
          // 获取价格
          const sellPrice = await getPrice(symbol); // 获取价格
          if (!sellPrice) throw new Error('获取价格失败');

          appendLog(`当前价格：${sellPrice}`, 'info');
          // 判断卖出价格是否比买入价格高
          if (Number(buyPrice) <= Number(sellPrice)) {
            submitPrice = sellPrice;
            appendLog(`价格上涨了，挂出${submitPrice}`, 'info');
          } else {
            const diff = floor((Number(buyPrice) / Number(sellPrice) - 1) * 100, 2);
            // 如果下滑超过0.1%，则卖出
            if (diff >= 0.1) {
              submitPrice = sellPrice;
              appendLog(`价格下滑${diff} %，挂出${submitPrice}`, 'info');
            } else {
              appendLog(`价格下滑${diff} %，原价挂出`, 'error');
            }
          }
          try {
            // 校验是否还有未卖出
            const isSell = await getIsSell(tab);
            if (!isSell) {
              appendLog('已卖出', 'info');
              isSuccess = true;
              break;
            }
            // 设置卖出价格
            await setPrice(tab, submitPrice);
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
            isSuccess = true;
          } catch (error: any) {
            appendLog(`卖出超时${sellCount + 1}次: ${error.message}`, 'error');
          }
          sellCount++;
        }

        while (!isSuccess) {
          appendLog('卖出超时，止损卖出', 'error');
          try {
            await backSell(tab, symbol, appendLog, timeout);
            isSuccess = true;
          } catch (error: any) {
            appendLog(error.message, 'error');
          }
        }

        // 等待2s
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 刷新余额
        const balance = await getBalance(tab);

        if (!balance) throw new Error('获取余额失败');

        appendLog(`刷新余额: ${balance}`, 'info');

        setCurrentBalance(balance);

        setNum(Date.now());
      } catch (error: any) {
        appendLog(error.message, 'error');
        if (error.message.includes('刷新页面')) {
          if (tab.id) await chrome.tabs.reload(tab.id);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        i--;
      }
    }

    // 等待1s
    await new Promise(resolve => setTimeout(resolve, 1000));
    // 校验是否有未知弹窗
    await checkUnknownModal(tab);
    // 校验是否有未取消的订单
    await cancelOrder(tab);
    // 兜底卖出
    await backSell(tab, symbol, appendLog, timeout);

    balance = await getBalance(tab);

    if (!balance) throw new Error('获取余额失败');

    appendLog(`刷新余额: ${balance}`, 'info');

    setCurrentBalance(balance);

    setNum(Date.now());

    appendLog('执行结束', 'success');

    if (secret) stopLoopAuth();

    setRuning(false);
  };

  return (
    <form className="mt-4 flex w-full flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <Label htmlFor="runNum" className="w-28 flex-none">
          操作次数
        </Label>
        <Input
          type="text"
          name="runNum"
          id="runNum"
          placeholder={`操作次数`}
          defaultValue={orderSetting.runNum ?? '1'}
          onChange={e => bicycleSettingStorage.setVal({ runNum: e.target.value ?? '' })}
        />
      </div>

      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <Label htmlFor="count" className="w-28 flex-none">
          保守设置(检测价格波动次数)
        </Label>
        <Input
          type="text"
          name="count"
          id="count"
          placeholder="保守设置(检测价格波动次数)"
          defaultValue={orderSetting.count ?? '3'}
          onChange={e => bicycleSettingStorage.setVal({ count: e.target.value ?? '' })}
        />
      </div>

      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <Label htmlFor="checkPriceTime" className="w-28 flex-none">
          挂单超时时间(秒)
        </Label>
        <Input
          type="text"
          name="checkPriceTime"
          id="checkPriceTime"
          placeholder={`卖出超时时间`}
          defaultValue={orderSetting.checkPriceTime ?? '1'}
          onChange={e => bicycleSettingStorage.setVal({ checkPriceTime: e.target.value ?? '' })}
        />
      </div>

      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <Label htmlFor="checkPriceCount" className="w-28 flex-none">
          卖出超时次数
        </Label>
        <Input
          type="text"
          name="checkPriceCount"
          id="checkPriceCount"
          placeholder={`卖出超时次数`}
          defaultValue={orderSetting.checkPriceCount ?? '60'}
          onChange={e => bicycleSettingStorage.setVal({ checkPriceCount: e.target.value ?? '' })}
        />
      </div>

      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <Label className="w-28 flex-none">下单金额模式</Label>
        <RadioGroup
          name="orderAmountMode"
          defaultValue={orderSetting.orderAmountMode ?? 'Fixed'}
          className="flex items-center gap-4"
          onValueChange={value => bicycleSettingStorage.setVal({ orderAmountMode: value as 'Fixed' | 'Random' })}>
          <div className="flex items-center">
            <RadioGroupItem value="Fixed" id="Fixed" />
            <Label htmlFor="Fixed" className="pl-2 text-xs">
              固定
            </Label>
          </div>
          <div className="flex items-center">
            <RadioGroupItem value="Random" id="Random" />
            <Label htmlFor="Random" className="pl-2 text-xs text-red-500">
              随机
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div
        className={cn(
          'flex w-full max-w-sm items-center justify-between gap-3',
          orderSetting.orderAmountMode === 'Random' ? 'hidden' : '',
        )}>
        <Label htmlFor="amount" className="w-28 flex-none">
          下单金额(每次操作金额{'(USDT)'})
        </Label>
        <Input
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          type="text"
          name="amount"
          id="amount"
          placeholder={`下单金额(每次操作金额(USDT))`}
          defaultValue={orderSetting.amount ?? ''}
          onChange={e => bicycleSettingStorage.setVal({ amount: e.target.value ?? '' })}
        />
      </div>

      <div
        className={cn(
          'flex w-full max-w-sm items-center justify-between gap-3',
          orderSetting.orderAmountMode === 'Fixed' ? 'hidden' : '',
        )}>
        <Label className="w-28 flex-none">下单金额(每次操作金额{'(USDT)'})</Label>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            type="text"
            name="minAmount"
            id="minAmount"
            placeholder={`最小金额`}
            defaultValue={orderSetting.minAmount ?? '50'}
            onChange={e => bicycleSettingStorage.setVal({ minAmount: e.target.value ?? '' })}
          />
          <div>-</div>
          <Input
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            type="text"
            name="maxAmount"
            id="maxAmount"
            placeholder={`最大金额`}
            defaultValue={orderSetting.maxAmount ?? '100'}
            onChange={e => bicycleSettingStorage.setVal({ maxAmount: e.target.value ?? '' })}
          />
        </div>
      </div>

      <div>
        <Button className="w-full" type="submit" disabled={runing || !startBalance}>
          执行
        </Button>
      </div>
    </form>
  );
};
