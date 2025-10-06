import '@src/Popup.css';
import {
  getPrice,
  setPrice,
  getBalance,
  setAmount,
  triggerBuy,
  checkBuy,
  checkByOrderBuy,
  goToSell,
  checkByOrderSell,
  getIsSell,
  checkWaterfall,
  checkUnknownModal,
  startLoopAuth,
  stopLoopAuth,
  cancelOrder,
} from './tool';
import { useStorage } from '@extension/shared';
import { bicycleSettingStorage, settingStorage, todayDealStorage } from '@extension/storage';
import { Button, cn, Input, Label, RadioGroup, RadioGroupItem } from '@extension/ui';
import dayjs, { extend } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { floor } from 'lodash-es';

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
  const orderSetting = useStorage(bicycleSettingStorage);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (runing) return;
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    // console.log('settingStorage.secret', settingStorage.secret);
    // 转成对象
    const data = Object.fromEntries(formData.entries()) as {
      amount: string;
      count: string;
      dot: string;
      type: 'Buy' | 'Sell';
      runNum: string;
      timeout: string;
      timeoutCount: string;
      orderAmountMode: 'Fixed' | 'Random';
      maxAmount: string;
      minAmount: string;
      checkPriceTime: string;
      checkPriceCount: string;
    };

    console.log(data);

    data.type = 'Buy';

    if (!data.count || !data.type || !data.runNum || !data.timeout || !data.checkPriceCount || !data.checkPriceTime) {
      appendLog('参数不能为空', 'error');
      setRuning(false);
      return;
    }
    // 校验amount count dot runNum 是否为数字
    if (
      isNaN(Number(data.count)) ||
      isNaN(Number(data.runNum)) ||
      isNaN(Number(data.timeout)) ||
      isNaN(Number(data.checkPriceCount)) ||
      isNaN(Number(data.checkPriceTime))
    ) {
      appendLog('参数必须为数字', 'error');
      setRuning(false);
      return;
    }
    // 校验下单金额
    if (data.orderAmountMode === 'Fixed') {
      if (!data.amount) {
        appendLog('下单金额不能为空', 'error');
        setRuning(false);
        return;
      }
      if (isNaN(Number(data.amount))) {
        appendLog('下单金额必须为数字', 'error');
        setRuning(false);
        return;
      }
    } else if (data.orderAmountMode === 'Random') {
      if (!data.maxAmount || !data.minAmount) {
        appendLog('下单金额范围不能为空', 'error');
        setRuning(false);
        return;
      }
      if (isNaN(Number(data.maxAmount)) || isNaN(Number(data.minAmount))) {
        appendLog('下单金额范围必须为数字', 'error');
        setRuning(false);
        return;
      }
      if (Number(data.maxAmount) < Number(data.minAmount)) {
        appendLog('下单金额范围错误', 'error');
        setRuning(false);
        return;
      }
    } else {
      appendLog('下单金额模式错误', 'error');
      setRuning(false);
      return;
    }

    setRuning(true);
    const runNum = data.runNum ? Number(data.runNum) : 1;
    let errorCount = 0;
    const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });
    const secret = (await settingStorage.get()).secret;
    let isStop = false;
    console.log('startLoopAuth', secret);
    if (secret) {
      startLoopAuth(tab, secret, () => {
        isStop = true;
        appendLog('出现验证码校验失败，自动停止', 'error');
      });
    }
    for (let i = 0; i < runNum; i++) {
      if (isStop) {
        break;
      }

      try {
        appendLog(`当前轮次: ${i + 1}`, 'info');
        // 校验是否有需要卖出
        appendLog(`校验是否有需要卖出`, 'info');
        await cancelOrder(tab);
        const isSell = await getIsSell(tab);
        let sum = 0;
        let isSuccess = false;
        while (isSell) {
          await goToSell(tab, true);
          const check = await checkByOrderSell(tab, Number(data.timeout)).catch(err => {
            appendLog(`卖出超时${sum + 1}次: ${err.message}`, 'error');
            sum++;
            isSuccess = false;
            return { error: err.message };
          });
          isSuccess = check?.error ? false : true;
          if (isSuccess) {
            break;
          }
        }

        // 校验未知弹窗风险
        await checkUnknownModal(tab);

        const balance = await getBalance(tab);

        if (!balance) return console.error('获取余额失败');

        if (!startBalance) {
          setStartBalance(balance);
        }

        setCurrentBalance(balance);

        const count = Number(data.count);
        // 计数
        let flow = 0;
        // 获取一个买入价格
        let lastPrice = '';

        // 校验是否大瀑布
        await checkWaterfall(tab);

        const prices = [] as number[];

        while (flow <= count) {
          const buyPrice = await getPrice(tab, data.type);
          if (!buyPrice) throw new Error('获取价格失败');
          appendLog(`获取到下单价格: ${buyPrice}`, 'info');
          prices.push(parseFloat(buyPrice));
          if (lastPrice === buyPrice || !lastPrice) {
            // 价格相同，添加计数
            flow++;
          } else {
            flow = 0;
          }
          // 新价格比上一个价格低，则可以提交订单
          if (lastPrice && lastPrice < buyPrice) {
            lastPrice = buyPrice;
            break;
          }
          lastPrice = buyPrice;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // 拿到最低价格
        lastPrice = Math.min(...prices).toString();

        appendLog(`设置下单价格: ${lastPrice}`, 'info');

        // 校验是否大瀑布
        await checkWaterfall(tab);

        // 设置价格
        await setPrice(tab, lastPrice);

        // 获取最近一个相反的价格
        const sellPrice = await getPrice(tab, data.type === 'Buy' ? 'Sell' : 'Buy');
        // 计算百分比
        const percent = 1 - Number(sellPrice) / Number(lastPrice);
        // 如果相反价格超过0.01则不买入
        if (percent > 0.01) {
          throw new Error('价格波动较大，跳过交易，开启下一轮');
        }

        const amount =
          data.orderAmountMode === 'Fixed'
            ? data.amount
            : floor(
                (Number(data.maxAmount) - Number(data.minAmount)) * Math.random() + Number(data.minAmount),
                2,
              ).toString();

        // 设置操作金额
        setAmount(tab, Number(amount));

        appendLog(`设置操作金额成功: ${amount}`, 'info');

        appendLog(`执行瀑布检测`, 'info');

        // 校验是否大瀑布
        await checkWaterfall(tab);

        await new Promise(resolve => setTimeout(resolve, 1000));

        const nextPrice = await getPrice(tab, data.type);

        if (nextPrice < lastPrice) {
          appendLog(`最新价格(${nextPrice})比下单价格(${lastPrice})低，跳过交易，开启下一轮`, 'error');
          // throw new Error(`最新价格(${nextPrice})比下单价格(${lastPrice})低，跳过交易，开启下一轮`);
          lastPrice = nextPrice;
        }

        // 操作确认买入
        await triggerBuy(tab);

        // 判断是否出现 超过可用余额 有可能是页面刷新不够快
        // await checkAmount(tab);

        appendLog(`操作买入待确认 下单价格: ${lastPrice} 操作金额: ${amount}`, 'info');

        // 校验是否大瀑布
        await checkWaterfall(tab);

        // 检查弹窗并确认
        await checkBuy(tab);

        appendLog(`操作买入确认`, 'info');

        // 监听买入订单是否已完成
        await checkByOrderBuy(tab, Number(data.timeout));

        const day = dayjs().utc().format('YYYY-MM-DD');

        todayDealStorage.setVal(day, amount);

        appendLog('前往卖出', 'info');

        // await new Promise(resolve => setTimeout(resolve, 1000));

        const timeoutCount = Number(data.timeoutCount ?? '1');

        let submitPrice = '';

        let submitCount = 0;

        while (sum < timeoutCount) {
          // 前往卖出
          const { price, isSell } = await goToSell(tab, false, lastPrice);
          submitPrice = price;
          if (submitCount > Number(data.checkPriceCount)) {
            const { price } = await goToSell(tab, false);
            submitPrice = price;
            appendLog(`卖出超时折损卖出`, 'error');
          } else {
            if (isSell === '-1') {
              appendLog(`当前价格比买入价低，原价挂出，等待${submitCount + 1}次`, 'error');
              submitCount++;
            }
          }

          appendLog(`等待订单完成`, 'info');

          // 校验卖出
          const check = await checkByOrderSell(tab, Number(data.timeout)).catch(err => {
            appendLog(`卖出超时${sum + 1}次: 价格：${price} ${err.message}`, 'error');
            if (submitCount > Number(data.checkPriceCount)) {
              sum++;
            }
            return { error: err.message };
          });
          isSuccess = check?.error ? false : true;
          console.log(check, isSuccess);
          if (isSuccess) {
            break;
          }
        }

        if (!isSuccess) {
          appendLog(`卖出超时${timeoutCount}次, 止损卖出`, 'error');
          while (true) {
            const { price } = await goToSell(tab, true);
            submitPrice = price;
            const check = await checkByOrderSell(tab, Number(data.timeout)).catch(err => {
              appendLog(`卖出超时${sum + 1}次: ${err.message}`, 'error');
              isSuccess = false;
              console.log(err.message);
              return { error: err.message };
            });
            isSuccess = check?.error ? false : true;
            if (isSuccess) {
              break;
            }
          }
        }

        if (!submitPrice) throw new Error('获取卖出价格失败, 卖单失败！！！');

        // 等待2s
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 刷新余额
        const lastBalance = await getBalance(tab);

        if (!lastBalance) throw new Error('获取余额失败');

        appendLog(`刷新余额: ${lastBalance}`, 'info');

        setCurrentBalance(lastBalance);

        setNum(Date.now());

        appendLog(`下单成功: ${amount}(USDT) 下单价格: ${lastPrice} 卖出价格: ${submitPrice}`, 'success');

        errorCount = 0;
      } catch (error: unknown) {
        console.error(error);
        if (error instanceof Error) {
          appendLog(error.message, 'error');
          if (error.message.includes('设置异常') || error.message.includes('刷新页面')) {
            if (tab.id) await chrome.tabs.reload(tab.id);
            errorCount = 0;
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
        if (errorCount > 5 || (i + 1) % 5 === 0) {
          // 刷新页面
          if (tab.id) await chrome.tabs.reload(tab.id);
          appendLog(`错误防抖刷新页面等待6s`, 'info');
          await new Promise(resolve => setTimeout(resolve, 6000));

          errorCount = 0;
        }
        errorCount++;
        i--;
      }

      appendLog(`当前轮次结束，等待1s 继续`, 'info');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    appendLog(`全部轮次结束 检测是否有卖出`, 'info');

    const isSell = await getIsSell(tab);
    let sum = 0;
    let isSuccess = false;
    while (isSell) {
      await goToSell(tab, true);
      const check = await checkByOrderSell(tab, Number(data.timeout)).catch(err => {
        appendLog(`卖出超时${sum + 1}次: ${err.message}`, 'error');
        sum++;
        isSuccess = false;
        return { error: err.message };
      });
      isSuccess = check?.error ? false : true;
      if (isSuccess) {
        break;
      }
    }

    if (secret) {
      stopLoopAuth();
    }

    appendLog(`停止`, 'info');

    setRuning(false);
  };

  return (
    <form className="mt-4 flex w-full flex-col gap-4" onSubmit={handleSubmit}>
      {/* <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <Label className="w-28 flex-none">买入价格类型</Label>
        <RadioGroup
          name="type"
          defaultValue={orderSetting.type ?? 'Sell'}
          className="flex items-center gap-4"
          onValueChange={value => bicycleSettingStorage.setVal({ type: value as 'Buy' | 'Sell' })}>
          <div className="flex items-center">
            <RadioGroupItem value="Buy" id="Buy" />
            <Label htmlFor="Buy" className="pl-2 text-xs text-green-500">
              买入价格(绿色)
            </Label>
          </div>
          <div className="flex items-center">
            <RadioGroupItem value="Sell" id="Sell" />
            <Label htmlFor="Sell" className="pl-2 text-xs text-red-500">
              卖出价格(红色)
            </Label>
          </div>
        </RadioGroup>
      </div> */}

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
        <Label htmlFor="timeout" className="w-28 flex-none">
          挂单超时(秒)
        </Label>
        <Input
          type="text"
          name="timeout"
          id="timeout"
          placeholder={`挂单超时`}
          defaultValue={orderSetting.timeout ?? '3'}
          onChange={e => bicycleSettingStorage.setVal({ timeout: e.target.value ?? '' })}
        />
      </div>

      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <Label htmlFor="checkPriceTime" className="w-28 flex-none">
          检查金额间隔(秒)
        </Label>
        <Input
          type="text"
          name="checkPriceTime"
          id="checkPriceTime"
          placeholder={`卖出超时次数(超出次数将以最佳价格卖出止损)`}
          defaultValue={orderSetting.checkPriceTime ?? '1'}
          onChange={e => bicycleSettingStorage.setVal({ checkPriceTime: e.target.value ?? '' })}
        />
      </div>

      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <Label htmlFor="checkPriceCount" className="w-28 flex-none">
          检查金额次数
        </Label>
        <Input
          type="text"
          name="checkPriceCount"
          id="checkPriceCount"
          placeholder={`卖出超出次数`}
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
