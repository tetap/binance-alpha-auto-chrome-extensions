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
import { useLogger } from './useLogger';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { todayDealStorage } from '@extension/storage';
import { Button, cn, ErrorDisplay, Input, Label, LoadingSpinner, RadioGroup, RadioGroupItem } from '@extension/ui';
import dayjs from 'dayjs';
import { useLayoutEffect, useMemo, useState } from 'react';

const Popup = () => {
  const deal = useStorage(todayDealStorage);

  const todayDeal = useMemo(() => {
    const day = dayjs().format('YYYY-MM-DD');
    return deal[day] ?? '0';
  }, [deal]);

  const [runing, setRuning] = useState(false);
  // 开始余额
  const [startBalance, setStartBalance] = useState('');
  // 当前余额
  const [currentBalance, setCurrentBalance] = useState('');
  // 日志
  const { render, appendLog, clearLogger } = useLogger();

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
    };

    if (!data.amount || !data.count || !data.dot || !data.type || !data.runNum || !data.timeout) {
      appendLog('参数不能为空', 'error');
      setRuning(false);
      return;
    }
    // 校验amount count dot runNum 是否为数字
    if (
      isNaN(Number(data.amount)) ||
      isNaN(Number(data.count)) ||
      isNaN(Number(data.dot)) ||
      isNaN(Number(data.runNum)) ||
      isNaN(Number(data.timeout))
    ) {
      appendLog('参数必须为数字', 'error');
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
        // 设置操作金额
        setAmount(tab, Number(data.amount));

        appendLog(`设置操作金额成功: ${data.amount}`, 'info');

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

        todayDealStorage.setVal(day, data.amount);

        appendLog(`下单成功: ${data.amount}(USDT) 下单价格: ${lastPrice} 反向价格: ${truncated}`, 'success');

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

  // 流水
  const op = useMemo(() => Number(currentBalance) - Number(startBalance), [currentBalance, startBalance]);

  useLayoutEffect(() => {
    (async (setStartBalance, setCurrentBalance, appendLog) => {
      try {
        const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });
        const balance = await getBalance(tab);
        setStartBalance(balance);
        setCurrentBalance(balance);
        appendLog(`获取余额成功: ${balance}`, 'success');
      } catch (error) {
        if (error instanceof Error) {
          appendLog(error.message, 'error');
        }
        appendLog(`获取余额失败，请确认是否进入正确页面后再开始操作`, 'error');
      }
    })(setStartBalance, setCurrentBalance, appendLog);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn('bg-slate-50', 'App flex gap-4 p-4')}>
      <form className="w-1/2" onSubmit={handleSubmit}>
        <div className="bg-background flex flex-col gap-2 rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-1/2 text-xs">
              开始余额: <b className="text-sm">{startBalance}</b>
            </div>
            <div className="w-1/2 text-xs">
              当前余额: <b className="text-sm">{currentBalance}</b>
            </div>
          </div>
        </div>

        <div className={cn(runing ? 'cursor-not-allowed' : '')}>
          <div className={cn(runing ? 'pointer-events-none' : '')}>
            <div className="mb-4 mt-4 grid w-full max-w-sm items-center gap-3">
              <Label>买入价格类型</Label>
              <RadioGroup name="type" defaultValue="Buy" className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Buy" id="Buy" />
                  <Label htmlFor="Buy" className="text-xs text-green-500">
                    买入价格(绿色)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Sell" id="Sell" />
                  <Label htmlFor="Sell" className="text-xs text-red-500">
                    卖出价格(红色)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid w-full max-w-sm items-center gap-3">
              <Label htmlFor="dot">出售保留小数点</Label>
              <Input type="text" name="dot" id="dot" placeholder="出售保留小数点" defaultValue={'3'} />
            </div>

            <div className="mt-4 grid w-full max-w-sm items-center gap-3">
              <Label htmlFor="count">保守设置(检测价格波动次数)</Label>
              <Input type="text" name="count" id="count" placeholder="保守设置(检测价格波动次数)" defaultValue={'3'} />
            </div>

            <div className="mt-4 grid w-full max-w-sm items-center gap-3">
              <Label htmlFor="runNum">操作次数</Label>
              <Input type="text" name="runNum" id="runNum" placeholder={`操作次数`} defaultValue={'3'} />
            </div>

            <div className="mt-4 grid w-full max-w-sm items-center gap-3">
              <Label htmlFor="timeout">挂单超时(秒)</Label>
              <Input type="text" name="timeout" id="timeout" placeholder={`挂单超时`} defaultValue={'3'} />
            </div>

            <div className="mt-4 grid w-full max-w-sm items-center gap-3">
              <Label htmlFor="amount">下单金额(每次操作金额{'(USDT)'})</Label>
              <Input
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                type="text"
                name="amount"
                id="amount"
                placeholder={`下单金额(每次操作金额(USDT))`}
                defaultValue={''}
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Button className="w-full" type="submit" disabled={runing || !startBalance}>
            执行
          </Button>
        </div>
      </form>
      <div className="flex w-1/2 flex-col gap-2">
        <div className="flex flex-none items-center justify-between text-sm font-bold">
          <div>日志输出</div>
          <Button variant={'outline'} onClick={clearLogger}>
            清空日志
          </Button>
        </div>
        {render}

        <div className="flex flex-none items-center justify-between text-xs">
          <div>
            当日交易额:<b className={cn('ml-2 text-sm text-green-500')}> {todayDeal}</b>
          </div>
          <div>
            操作损耗:<b className={cn('ml-2 text-sm', op > 0 ? 'text-green-500' : 'text-red-500')}> {op}</b>
          </div>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
