import {
  stopLoopAuth,
  startLoopAuth,
  backSell,
  callSubmit,
  cancelOrder,
  checkUnknownModal,
  getBalance,
  getId,
  getPrice,
  isAuthModal,
  // jumpToBuy,
  openReverseOrder,
  setLimitTotal,
  setPrice,
  setReversePrice,
  waitBuyOrder,
  injectDependencies,
  waitSellOrder,
  startRandom,
  stopRandom,
} from '../tool/tool_v1';
import { useStorage } from '@extension/shared';
import { settingStorage, StategySettingStorage, todayDealStorage, todayNoMulDealStorage } from '@extension/storage';
import { Button, cn, Input, Label, RadioGroup, RadioGroupItem } from '@extension/ui';
import { checkMarketStable } from '@src/tool/strategy';
import dayjs, { extend } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { floor } from 'lodash-es';
import { useRef } from 'react';
import type { IPanelProps } from '../props/type';

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

  const getOptions = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const setting = await settingStorage.get();
    const data = Object.fromEntries(formData.entries()) as {
      amount: string;
      count: string;
      runNum: string;
      runPrice: string;
      runType: (typeof setting)['runType'];
      timeout: string;
      orderAmountMode: 'Fixed' | 'Random';
      maxAmount: string;
      minAmount: string;
      dot: string;
      minSleep: string;
      maxSleep: string;
      minDiscount: string;
      maxDiscount: string;
      priceRatio: string;
    };

    if (!data.timeout || !data.count || !data.minDiscount || !data.maxDiscount) {
      throw new Error('参数不能为空');
    }
    if (isNaN(Number(data.count)) || isNaN(Number(data.minDiscount)) || isNaN(Number(data.maxDiscount))) {
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

    if (Number(data.minDiscount) > Number(data.maxDiscount)) {
      throw new Error('最小折价率不能高度最高折价率');
    }

    const runNum = setting['runNum'];
    const runPrice = setting['runPrice'];
    const runType = setting['runType'];

    data['runNum'] = runNum;
    data['runPrice'] = runPrice;
    data['runType'] = runType;

    data['minSleep'] = setting['minSleep'] || '1';
    data['maxSleep'] = setting['maxSleep'] || '5';

    data['priceRatio'] = setting['priceRatio'] || '0.5';

    if (Number(data['maxSleep']) <= Number(data['minSleep'])) {
      throw new Error('最大延迟时间不能小于最小延迟时间');
    }

    if (data['runType'] === 'sum' && !data['runNum']) {
      throw new Error('请输入运行次数');
    } else if (data['runType'] === 'price' && !data['runPrice']) {
      throw new Error('请输入运行价格');
    }

    return data;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (runing) {
      stopRef.current = true;
      appendLog('正在停止中，请等待本次执行完成', 'info');
      e.preventDefault();
      return;
    }

    const options = await getOptions(e).catch(error => {
      appendLog(error.message, 'error');
      throw new Error(error.message);
    });

    stopRef.current = false;

    setRuning(true);

    const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });

    const id = await getId(tab, api).catch(() => null); // 获取货币id

    if (!id || !id.symbol) {
      appendLog('获取货币id失败', 'error');
      setRuning(false);
      return;
    }

    const minSleep = options.maxSleep ? Number(options.minSleep) : 1;
    const maxSleep = options.maxSleep ? Number(options.maxSleep) : 5;

    const { symbol, mul } = id;

    appendLog(`获取到货币id: ${symbol} 积分乘数: ${mul}`, 'info');

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

    const runType = options.runType;

    let runNum = options.runNum ? Number(options.runNum) : 1; // 运行次数

    const runPrice = options.runPrice ? Number(options.runPrice) : 1; // 运行金额

    if (runType === 'price') {
      runNum = Number.MAX_VALUE;
    }

    const timeout = options.timeout ? Number(options.timeout) : 1; // 下单超时时间

    const count = Number(options.count); // 保守设置

    let balance = await getBalance(tab);

    if (!balance) return console.error('获取余额失败');

    if (!startBalance) {
      setStartBalance(balance);
    }
    let index = 0;
    let BuyOk = false;
    await injectDependencies(tab);
    await startRandom(tab);
    for (let i = 0; i < runNum; i++) {
      index++;
      injectDependencies(tab);

      if (stopRef.current) {
        appendLog(`意外终止`, 'error');
        break;
      }
      appendLog(`当前轮次: ${i + 1}`, 'info');

      try {
        let sleepTime = Math.floor(Math.random() * (maxSleep - minSleep + 1) + minSleep) * 1000;

        // 校验是否有未知弹窗
        await checkUnknownModal(tab);
        // 校验是否有未取消的订单
        await cancelOrder(tab);
        // 兜底卖出
        await backSell(tab, api, symbol, appendLog, timeout, BuyOk);

        BuyOk = false;

        // 刷新余额
        const balance = await getBalance(tab);

        if (!balance) throw new Error('获取余额失败');

        appendLog(`刷新余额: ${balance}`, 'info');

        setCurrentBalance(balance);

        setNum(Date.now());

        sleepTime = Math.floor(Math.random() * (maxSleep - minSleep + 1) + minSleep) * 1000;

        await new Promise(resolve => setTimeout(resolve, sleepTime));

        const stable = await checkMarketStable(api, symbol, await StategySettingStorage.get());

        if (!stable.stable) {
          appendLog(stable.message, 'error');
          i--;
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        } else {
          appendLog(stable.message, 'success');
        }

        // 开启反向订单
        await openReverseOrder(tab);
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

        appendLog(`获取到买入价格: ${buyPrice}`, 'info');

        // buyPrice = stable.trend === '上涨趋势' ? (Number(buyPrice) + Number(buyPrice) * 0.0001).toString() : buyPrice; // 调整买入价
        // const submitPrice =
        //   stable.trend === '上涨趋势'
        //     ? (Number(buyPrice) + Number(buyPrice) * 0.0001).toString()
        //     : (Number(buyPrice) + Number(buyPrice) * 0.00001).toString(); // 调整买入价

        // const submitPrice =
        //   stable.trend === '上涨趋势' ? (Number(buyPrice) + Number(buyPrice) * 0.0001).toString() : buyPrice;

        // 溢价率 %
        const priceRatio = Number(options.priceRatio);
        // 计算小数点数量
        const pricePrecision = buyPrice.toString().split('.')[1].length;
        // 调整买入价
        const submitPrice = floor(Number(buyPrice) * (1 + priceRatio * 0.01), pricePrecision).toString();

        // 操作写入买入价格
        await setPrice(tab, submitPrice);
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

        // // 设想反向订单价格
        // const num = parseFloat(buyPrice);
        // // 根据dot参数保留小数点位数
        // const basic = 1 * 10 ** Number(options.dot);
        // const truncated = Math.floor(num * basic) / basic;

        const discount = floor(
          (Number(options.maxDiscount) - Number(options.minDiscount)) * Math.random() + Number(options.minDiscount),
          6,
        );

        // 卖出价格
        const truncated = (Number(buyPrice) * (1 - discount / 100)).toString();

        // 设置反向订单价格
        await setReversePrice(tab, truncated.toString());
        // 操作确认买入
        await callSubmit(tab);
        // 判断是否出现验证码
        const isAuth = await isAuthModal(tab);
        // 出现验证弹窗等待
        if (isAuth) {
          appendLog('出现验证码等待过验证', 'info');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
        // 等待订单完成
        BuyOk = await waitBuyOrder(tab, timeout);

        BuyOk = !(await waitSellOrder(tab, timeout));

        appendLog(`下单成功: 价格： ${buyPrice} 金额：${amount}`, 'success');

        const day = dayjs().utc().format('YYYY-MM-DD');

        todayNoMulDealStorage.setVal(day, amount);

        todayDealStorage.setVal(day, (Number(amount) * mul).toString());

        sleepTime = Math.floor(Math.random() * (maxSleep - minSleep + 1) + minSleep) * 1000;

        await new Promise(resolve => setTimeout(resolve, timeout * 1000));

        await cancelOrder(tab);

        // await backSell(tab, api, symbol, appendLog, timeout);

        const price = Number(await todayDealStorage.getVal(day));

        if (runType === 'price' && price >= runPrice) {
          break;
        }
      } catch (error: any) {
        appendLog(error.message, 'error');
        if (error.message.includes('刷新页面')) {
          if (tab.id) await chrome.tabs.reload(tab.id);
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else if (index % 10 === 0 || error.message.includes('不存在')) {
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

    await stopRandom(tab);

    appendLog(`刷新余额: ${balance}`, 'info');

    setCurrentBalance(balance);

    setNum(Date.now());

    appendLog('执行结束', 'success');

    if (secret) stopLoopAuth();

    setRuning(false);
  };

  return (
    <form className="mt-4 flex w-full flex-col gap-4" onSubmit={handleSubmit}>
      {/* <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <Label htmlFor="dot" className="w-28 flex-none">
          出售保留小数点
        </Label>
        <Input
          type="text"
          name="dot"
          id="dot"
          disabled={runing}
          placeholder="出售保留小数点"
          defaultValue={setting.dot ?? '3'}
          onChange={e => settingStorage.setVal({ dot: e.target.value ?? '' })}
        />
      </div> */}

      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <Label className="w-28 flex-none">反向订单折价(%)</Label>
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Input
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              disabled={runing}
              spellCheck={false}
              type="text"
              name="minDiscount"
              id="minDiscount"
              placeholder={`最小折价(%)`}
              defaultValue={setting.minDiscount ?? '0.3'}
              onChange={e => settingStorage.setVal({ minDiscount: e.target.value ?? '' })}
            />
            <div>-</div>
            <Input
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              type="text"
              name="maxDiscount"
              id="maxDiscount"
              disabled={runing}
              placeholder={`最大折价(%)`}
              defaultValue={setting.maxDiscount ?? '0.5'}
              onChange={e => settingStorage.setVal({ maxDiscount: e.target.value ?? '' })}
            />
          </div>
        </div>
      </div>

      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <Label htmlFor="count" className="w-28 flex-none">
          保守设置(检测价格波动次数)
        </Label>
        <Input
          type="text"
          name="count"
          id="count"
          disabled={runing}
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
          disabled={runing}
          placeholder={`挂单超时`}
          defaultValue={setting.timeout ?? '3'}
          onChange={e => settingStorage.setVal({ timeout: e.target.value ?? '' })}
        />
      </div>

      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <Label className="w-28 flex-none">下单金额模式</Label>
        <RadioGroup
          name="orderAmountMode"
          disabled={runing}
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
          disabled={runing}
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
            disabled={runing}
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
            disabled={runing}
            placeholder={`最大金额`}
            defaultValue={setting.maxAmount ?? '100'}
            onChange={e => settingStorage.setVal({ maxAmount: e.target.value ?? '' })}
          />
        </div>
      </div>

      <div>
        <Button className="w-full" type="submit" disabled={!startBalance}>
          {runing ? '终止' : '执行'}
        </Button>
      </div>
    </form>
  );
};
