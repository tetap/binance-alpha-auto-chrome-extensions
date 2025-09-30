import '@src/Popup.css';
import {
  getPrice,
  setPrice,
  getBalance,
  setAmount,
  triggerBuy,
  checkBuy,
  checkReverseOrder,
  setReversePrice,
  checkOrder,
  checkWaterfall,
} from './tool';
import { useStorage } from '@extension/shared';
import { settingStorage, todayDealStorage } from '@extension/storage';
import { Button, cn, Input, Label, RadioGroup, RadioGroupItem } from '@extension/ui';
import dayjs from 'dayjs';
import { floor } from 'lodash-es';

export interface IRerverseModeProps {
  setCurrentBalance: (balance: string) => void;
  startBalance: string;
  setStartBalance: (balance: string) => void;
  runing: boolean;
  setRuning: (runing: boolean) => void;
  appendLog: (msg: string, type: 'success' | 'error' | 'info') => void;
  setNum: (num: number) => void;
}

export const ReverseMode = ({
  setCurrentBalance,
  setStartBalance,
  startBalance,
  runing,
  setRuning,
  appendLog,
  setNum,
}: IRerverseModeProps) => {
  const setting = useStorage(settingStorage);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (runing) return;
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    // 转成对象
    const data = Object.fromEntries(formData.entries()) as {
      amount: string;
      count: string;
      dot: string;
      type: 'Buy' | 'Sell';
      runNum: string;
      timeout: string;
      orderAmountMode: 'Fixed' | 'Random';
      maxAmount: string;
      minAmount: string;
    };

    if (!data.count || !data.dot || !data.type || !data.runNum || !data.timeout) {
      appendLog('参数不能为空', 'error');
      setRuning(false);
      return;
    }
    // 校验amount count dot runNum 是否为数字
    if (
      isNaN(Number(data.count)) ||
      isNaN(Number(data.dot)) ||
      isNaN(Number(data.runNum)) ||
      isNaN(Number(data.timeout))
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
    for (let i = 0; i < runNum; i++) {
      try {
        appendLog(`当前轮次: ${i + 1}`, 'info');

        const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });

        const balance = await getBalance(tab);

        if (!balance) return console.error('获取余额失败');

        if (!startBalance) {
          setStartBalance(balance);
        }

        setCurrentBalance(balance);

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

        const count = Number(data.count);
        // 计数
        let flow = 0;
        // 获取一个买入价格
        let lastPrice = '';
        // 确保打开反向订单
        await checkReverseOrder(tab);

        // 校验是否大瀑布
        await checkWaterfall(tab);

        while (flow < count) {
          const buyPrice = await getPrice(tab, data.type);
          if (!buyPrice) throw new Error('获取价格失败');
          appendLog(`获取到下单价格: ${buyPrice}`, 'info');
          if (lastPrice === buyPrice || !lastPrice) {
            // 价格相同，添加计数
            flow++;
          } else {
            flow = 0;
          }
          lastPrice = buyPrice;
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        appendLog(`设置下单价格: ${lastPrice}`, 'info');

        // 校验是否大瀑布
        await checkWaterfall(tab);

        // 设置价格
        await setPrice(tab, lastPrice);

        appendLog(`执行瀑布检测`, 'info');

        // 获取最近一个相反的价格
        const sellPrice = await getPrice(tab, data.type === 'Buy' ? 'Sell' : 'Buy');
        // 计算百分比
        const percent = 1 - Number(sellPrice) / Number(lastPrice);
        // 如果相反价格超过0.01则不买入
        if (percent > 0.01) {
          throw new Error('价格波动较大，跳过交易，开启下一轮');
        }

        // 设想反向订单价格
        const num = parseFloat(lastPrice);
        // 根据dot参数保留小数点位数
        const basic = 1 * 10 ** Number(data.dot);
        const truncated = Math.floor(num * basic) / basic;

        // 设置反向订单价格
        await setReversePrice(tab, truncated.toString());

        appendLog(`设置反向订单价格: ${truncated}`, 'info');

        // 操作确认买入
        await triggerBuy(tab);

        appendLog(`操作买入待确认`, 'info');

        // 检查弹窗并确认
        await checkBuy(tab);

        appendLog(`操作买入确认`, 'info');

        // 监听订单是否已完成
        await checkOrder(tab, Number(data.timeout));

        appendLog(`等待订单完成`, 'info');

        // 等待1s
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 刷新余额
        const lastBalance = await getBalance(tab);

        if (!lastBalance) throw new Error('获取余额失败');

        appendLog(`刷新余额: ${lastBalance}`, 'info');

        setCurrentBalance(lastBalance);

        const day = dayjs().format('YYYY-MM-DD');

        todayDealStorage.setVal(day, amount);

        setNum(Date.now());

        appendLog(`下单成功: ${amount}(USDT) 下单价格: ${lastPrice} 反向价格: ${truncated}`, 'success');

        errorCount = 0;
      } catch (error: unknown) {
        if (error instanceof Error) {
          appendLog(error.message, 'error');
        }
        console.error(error);
        if (errorCount > 10) {
          // 刷新页面
          const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });
          if (tab.id) chrome.tabs.reload(tab.id);
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

    appendLog(`停止`, 'info');

    setRuning(false);
  };

  return (
    <form className="mt-4 flex w-full flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <Label className="w-28 flex-none">买入价格类型</Label>
        <RadioGroup
          name="type"
          defaultValue={setting.type ?? 'Buy'}
          className="flex items-center gap-4"
          onValueChange={value => settingStorage.setVal({ type: value as 'Buy' | 'Sell' })}>
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
