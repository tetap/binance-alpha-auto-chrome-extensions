import '@src/Popup.css';
import { BicycleMode } from './bicycle-mode';
import { OrderMode } from './order-mode';
import { ReverseMode } from './reverse-mode';
import { getBalance } from './tool';
import { useLogger } from './useLogger';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { settingStorage, todayDealStorage } from '@extension/storage';
import {
  Button,
  cn,
  ErrorDisplay,
  Input,
  Label,
  LoadingSpinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@extension/ui';
import dayjs, { extend } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { useLayoutEffect, useMemo, useState } from 'react';

extend(utc);

const Popup = () => {
  const [num, setNum] = useState(0);
  const setting = useStorage(settingStorage);
  const deal = useStorage(todayDealStorage);

  const todayDeal = useMemo(() => {
    const day = dayjs().utc().format('YYYY-MM-DD');
    console.log(day, deal);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    typeof num;
    return deal[day] ?? '0';
  }, [deal, num]);

  const [runing, setRuning] = useState(false);
  // 开始余额
  const [startBalance, setStartBalance] = useState('');
  // 当前余额
  const [currentBalance, setCurrentBalance] = useState('');
  // 日志
  const { render, appendLog, clearLogger } = useLogger();

  // 流水
  const op = useMemo(() => {
    const b1 = currentBalance.replace(/,/g, '');
    const b2 = startBalance.replace(/,/g, '');
    console.log(b1, b2);
    return Number(b1) - Number(b2);
  }, [currentBalance, startBalance]);

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
    <div className={cn('bg-slate-50', 'App p-4 pb-0')}>
      <div className="flex min-h-0 flex-col gap-4">
        <div className="w-full">
          <div className="bg-background mb-4 flex flex-col gap-2 rounded-md p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="w-1/2 text-xs">
                开始余额: <b className="text-sm">{startBalance}</b>
              </div>
              <div className="w-1/2 text-xs">
                当前余额: <b className="text-sm">{currentBalance}</b>
              </div>
            </div>
          </div>

          <div className="mb-4 flex w-full max-w-sm items-center justify-between gap-3">
            <Label htmlFor="secret" className="w-28 flex-none">
              二次验证(secret)
            </Label>
            <Input
              type="password"
              name="secret"
              id="secret"
              placeholder="自动过验证码 需要开启二次验证"
              defaultValue={setting.secret ?? ''}
              onChange={e => settingStorage.setVal({ secret: e.target.value ?? '' })}
            />
          </div>

          <div className={cn(runing ? 'cursor-not-allowed' : '')}>
            <div className={cn(runing ? 'pointer-events-none' : '')}>
              <Tabs
                defaultValue={setting.mode ?? 'Reverse'}
                className="w-full"
                onValueChange={value => settingStorage.setVal({ mode: value as 'Reverse' | 'Order' })}>
                <TabsList>
                  <TabsTrigger value="Reverse">反向订单</TabsTrigger>
                  <TabsTrigger value="Order">手动卖出</TabsTrigger>
                  <TabsTrigger value="Bicycle">摩托变单车</TabsTrigger>
                </TabsList>
                <TabsContent value="Reverse">
                  <ReverseMode
                    setCurrentBalance={setCurrentBalance}
                    setRuning={setRuning}
                    setStartBalance={setStartBalance}
                    startBalance={startBalance}
                    runing={runing}
                    appendLog={appendLog}
                    setNum={setNum}
                  />
                </TabsContent>
                <TabsContent value="Order">
                  <OrderMode
                    setCurrentBalance={setCurrentBalance}
                    setRuning={setRuning}
                    setStartBalance={setStartBalance}
                    startBalance={startBalance}
                    runing={runing}
                    appendLog={appendLog}
                    setNum={setNum}
                  />
                </TabsContent>
                <TabsContent value="Bicycle">
                  <BicycleMode
                    setCurrentBalance={setCurrentBalance}
                    setRuning={setRuning}
                    setStartBalance={setStartBalance}
                    startBalance={startBalance}
                    runing={runing}
                    appendLog={appendLog}
                    setNum={setNum}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        <div className="flex h-96 w-full flex-col gap-2">
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
      <div className="flex h-8 flex-none items-center justify-center">
        <a
          target="_blank"
          href="https://github.com/tetap/binance-alpha-auto-chrome-extensions"
          className="text-purple-600 hover:text-purple-800">
          By: Tetap&nbsp;Github
        </a>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
