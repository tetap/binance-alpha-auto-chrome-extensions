import '@src/Popup.css';
import { stopLoopAuth, startLoopAuth } from './tool';
import {
  backSell,
  callSubmit,
  cancelOrder,
  checkMarketStable,
  checkUnknownModal,
  // detectDropRisk,
  getBalance,
  getId,
  getPrice,
  // getPriceList,
  isAuthModal,
  jumpToBuy,
  openReverseOrder,
  setLimitTotal,
  setPrice,
  setReversePrice,
  waitBuyOrder,
  injectDependencies,
} from './tool_v1';
import { useStorage } from '@extension/shared';
import { settingStorage, todayDealStorage } from '@extension/storage';
import { Button, cn, Input, Label, RadioGroup, RadioGroupItem } from '@extension/ui';
import dayjs, { extend } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { floor } from 'lodash-es';
import { useRef } from 'react';
import type { IPanelProps } from './type';

extend(utc);

export const ReverseMode = ({
  setCurrentBalance,
  setStartBalance,
  startBalance,
  runing,
  setRuning,
  appendLog,
  setNum,
  api,
}: IPanelProps) => {
  const stopRef = useRef(false);
  const setting = useStorage(settingStorage);

  const getOptions = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries()) as {
      amount: string;
      count: string;
      runNum: string;
      timeout: string;
      orderAmountMode: 'Fixed' | 'Random';
      maxAmount: string;
      minAmount: string;
      dot: string;
    };

    if (!data.runNum || !data.timeout || !data.count || !data.dot) {
      throw new Error('参数不能为空');
    }
    if (isNaN(Number(data.runNum)) || isNaN(Number(data.dot)) || isNaN(Number(data.count))) {
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
    const options = getOptions(e);

    stopRef.current = false;

    setRuning(true);

    const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });

    const symbol = await getId(tab, api).catch(() => ''); // 获取货币id

    if (!symbol) {
      appendLog('获取货币id失败', 'error');
      setRuning(false);
      return;
    }

    const secret = (await settingStorage.get()).secret;
    if (secret) {
      startLoopAuth(tab, secret, () => {
        stopRef.current = true;
        appendLog('出现验证码校验失败，自动停止', 'error');
      });
    }

    const runNum = options.runNum ? Number(options.runNum) : 1; // 运行次数

    const timeout = options.timeout ? Number(options.timeout) : 1; // 下单超时时间

    const count = Number(options.count); // 保守设置

    let balance = await getBalance(tab);

    if (!balance) return console.error('获取余额失败');

    if (!startBalance) {
      setStartBalance(balance);
    }
    for (let i = 0; i < runNum; i++) {
      injectDependencies(tab);

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
        await backSell(tab, api, symbol, appendLog, timeout);
        // 回到买入面板
        await jumpToBuy(tab);

        const stable = await checkMarketStable(api, symbol);

        if (!stable.stable) {
          appendLog(stable.message, 'error');
          i--;
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        } else {
          appendLog(stable.message, 'success');
        }

        // 抖动检测
        // const trades = await getPriceList(symbol);
        // console.log('trades', trades);
        // // 获取抖动窗口
        // const priceWindows = detectDropRisk(trades, {
        //   buyIndex: 0,
        //   windowMs: 10_000,
        //   thresholdPct: 0.1,
        //   volumeWeighted: true,
        // });
        // appendLog(`价格抖动窗口: 是否买入: ${priceWindows.hasRisk ? '取消' : '买入'};`, 'info');
        // appendLog(`价格抖动窗口: 买入价: ${priceWindows.buyPrice};最低价: ${priceWindows.minPrice};`, 'info');
        // if (priceWindows.hasRisk) {
        //   i--;
        //   await new Promise(resolve => setTimeout(resolve, 3000));
        //   continue;
        // }
        let buyPrice = await getPrice(symbol, api);
        appendLog(`保守设置次数:${count}`, 'info');
        for (let j = 0; j < count; j++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          // 获取买入价
          const curPrice = await getPrice(symbol, api); // 获取价格
          appendLog(`当前价格：${curPrice}`, 'info');
          if (Number(curPrice) < Number(buyPrice)) {
            buyPrice = curPrice;
            appendLog(`价格下跌，调整买入价为${buyPrice}`, 'info');
          }
        }
        if (!buyPrice) throw new Error('获取价格失败');

        // const checkPrice = await getPrice(symbol, api); // 获取价格

        // if (Number(checkPrice) < Number(buyPrice)) {
        //   appendLog(`价格${buyPrice}下滑到${checkPrice}，休息一会儿`, 'error');
        //   await new Promise(resolve => setTimeout(resolve, 6000));
        //   throw new Error(`价格${buyPrice}下滑到${checkPrice}，停止买入`);
        // }

        appendLog(`获取到买入价格: ${buyPrice}`, 'info');

        buyPrice = stable.trend === '上涨趋势' ? (Number(buyPrice) + Number(buyPrice) * 0.0001).toString() : buyPrice; // 调整买入价

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

        await openReverseOrder(tab);

        // 设想反向订单价格
        const num = parseFloat(buyPrice);
        // 根据dot参数保留小数点位数
        const basic = 1 * 10 ** Number(options.dot);
        const truncated = Math.floor(num * basic) / basic;

        // 设置反向订单价格
        await setReversePrice(tab, truncated.toString());
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
        await waitBuyOrder(tab, timeout);

        appendLog(`下单成功: 价格： ${buyPrice} 金额：${amount}`, 'success');

        const day = dayjs().utc().format('YYYY-MM-DD');

        todayDealStorage.setVal(day, amount);

        await new Promise(resolve => setTimeout(resolve, (timeout + 2) * 1000));

        await cancelOrder(tab);

        await backSell(tab, api, symbol, appendLog, timeout);

        await new Promise(resolve => setTimeout(resolve, 1000));

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
    await backSell(tab, api, symbol, appendLog, timeout);

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
          defaultValue={setting.runNum ?? '1'}
          onChange={e => settingStorage.setVal({ runNum: e.target.value ?? '' })}
        />
      </div>

      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <Label htmlFor="dot" className="w-28 flex-none">
          出售保留小数点
        </Label>
        <Input
          type="text"
          name="dot"
          id="dot"
          placeholder="出售保留小数点"
          defaultValue={setting.dot ?? '3'}
          onChange={e => settingStorage.setVal({ dot: e.target.value ?? '' })}
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
          defaultValue={setting.count ?? '3'}
          onChange={e => settingStorage.setVal({ count: e.target.value ?? '' })}
        />
      </div>

      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <Label htmlFor="timeout" className="w-28 flex-none">
          挂单超时(秒)
        </Label>
        <Input
          type="text"
          name="timeout"
          id="timeout"
          placeholder={`挂单超时`}
          defaultValue={setting.timeout ?? '3'}
          onChange={e => settingStorage.setVal({ timeout: e.target.value ?? '' })}
        />
      </div>

      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <Label className="w-28 flex-none">下单金额模式</Label>
        <RadioGroup
          name="orderAmountMode"
          defaultValue={setting.orderAmountMode ?? 'Fixed'}
          className="flex items-center gap-4"
          onValueChange={value => settingStorage.setVal({ orderAmountMode: value as 'Fixed' | 'Random' })}>
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
          setting.orderAmountMode === 'Random' ? 'hidden' : '',
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
          defaultValue={setting.amount ?? ''}
          onChange={e => settingStorage.setVal({ amount: e.target.value ?? '' })}
        />
      </div>

      <div
        className={cn(
          'flex w-full max-w-sm items-center justify-between gap-3',
          setting.orderAmountMode === 'Fixed' ? 'hidden' : '',
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
            defaultValue={setting.minAmount ?? '50'}
            onChange={e => settingStorage.setVal({ minAmount: e.target.value ?? '' })}
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
            defaultValue={setting.maxAmount ?? '100'}
            onChange={e => settingStorage.setVal({ maxAmount: e.target.value ?? '' })}
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
