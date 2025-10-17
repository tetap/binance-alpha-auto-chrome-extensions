import '@src/style/Popup.css';
import { OrderMode } from './mode/order-mode';
import { ReverseMode } from './mode/reverse-mode';
import { base32Encode, parseMigrationQRCode } from './tool/protobuf';
import { getBalance } from './tool/tool_v1';
import { isNewerVersion } from './tool/version';
import { useLogger } from './useLogger';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { settingStorage, StategySettingStorage, todayDealStorage, todayNoMulDealStorage } from '@extension/storage';
import {
  Button,
  ChevronsUpDown,
  cn,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  ErrorDisplay,
  Input,
  Label,
  LoadingSpinner,
  RadioGroup,
  RadioGroupItem,
  Scan,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@extension/ui';
import dayjs, { extend } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import jsqr from 'jsqr';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

extend(utc);

const Popup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState({ update: false, version: '', url: '' });
  const [num, setNum] = useState(0);
  const setting = useStorage(settingStorage);
  const strategy = useStorage(StategySettingStorage);
  const deal = useStorage(todayDealStorage);
  const noMulDeal = useStorage(todayNoMulDealStorage);

  const todayDeal = useMemo(() => {
    const day = dayjs().utc().format('YYYY-MM-DD');
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    typeof num;
    return deal[day] ?? '0';
  }, [deal, num]);

  const todayNoMulDeal = useMemo(() => {
    const day = dayjs().utc().format('YYYY-MM-DD');
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    typeof num;
    return noMulDeal[day] ?? '0';
  }, [noMulDeal, num]);

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

  const handleScan = useCallback(() => {
    // 获取文件
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = '.png,.jpg,.jpeg,.gif';
    file.onchange = async e => {
      const target = e.target as HTMLInputElement;
      const input = target.files;
      if (!input?.length) return alert('请选择图片文件');
      const inputFile = input[0];
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return alert('请使用chrome浏览器打开');
      const img = new Image();
      img.src = URL.createObjectURL(inputFile);
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        try {
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const data = jsqr(imageData.data, imageData.width, imageData.height);
          if (!data?.data) throw new Error('二维码内容错误，请重新扫描');
          const results = parseMigrationQRCode(data.data);
          if (!results.length || results.length > 1) throw new Error('请导入正确的二维码，不要导入多条');
          const { secretBytes } = results[0];
          if (!secretBytes) throw new Error('二维码内容错误，请重新扫描');
          const secret = base32Encode(secretBytes);
          settingStorage.setVal({ secret });
          alert('导入成功');
        } catch (error: any) {
          alert(error.message);
        }
      };

      file.remove();
    };
    file.click();
  }, []);

  const getNewVersion = async () => {
    const response = await fetch(
      'https://api.github.com/repos/tetap/binance-alpha-auto-chrome-extensions/releases/latest',
    );
    const json = await response.json();
    const tag_name = json.tag_name;
    const html_url = json.html_url;
    // 判断当前版本是否需要更新
    const currentVersion = chrome.runtime.getManifest().version;
    setUpdateInfo({
      version: tag_name,
      url: html_url,
      update: isNewerVersion(tag_name, currentVersion),
    });
  };

  useLayoutEffect(() => {
    getNewVersion();
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
          <div className="mb-2 flex flex-none items-center justify-between">
            <a
              target="_blank"
              href="https://github.com/tetap/binance-alpha-auto-chrome-extensions"
              className="text-purple-600 hover:text-purple-800">
              当前版本: v{chrome.runtime.getManifest().version}
            </a>

            {updateInfo.update && (
              <a target="_blank" href={updateInfo.url} className="text-purple-600 hover:text-purple-800">
                发现新版本: {updateInfo.version}
              </a>
            )}
          </div>

          <div className="mb-2 text-xs">
            <div>
              <div>
                当日积分交易额:<b className={cn('ml-2 text-sm text-green-500')}> {todayDeal}</b>
              </div>
              <div>
                当日交易额:<b className={cn('ml-2 text-sm text-green-500')}> {todayNoMulDeal}</b>
              </div>
            </div>
            <div>
              操作损耗:<b className={cn('ml-2 text-sm', op > 0 ? 'text-green-500' : 'text-red-500')}> {op}</b>
            </div>
          </div>

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
            <div className="relative w-full">
              <Input
                type="password"
                name="secret"
                id="secret"
                className="pr-8"
                placeholder="自动过验证码 需要开启二次验证"
                defaultValue={setting.secret ?? ''}
                disabled={runing}
                onChange={e => settingStorage.setVal({ secret: e.target.value ?? '' })}
              />
              <Button
                variant={'ghost'}
                disabled={runing}
                size={'icon'}
                className="absolute bottom-0 right-0 top-0 z-10 my-auto"
                onClick={() => handleScan()}>
                <Scan size={14} />
              </Button>
            </div>
          </div>

          <div className="mb-4 flex w-full max-w-sm items-center justify-between gap-3">
            <Label htmlFor="api" className="w-28 flex-none">
              API地址
            </Label>
            <Input
              name="api"
              id="api"
              placeholder="如果可以访问就不要改"
              disabled={runing}
              defaultValue={setting.api ?? 'https://www.binance.com'}
              onChange={e => settingStorage.setVal({ api: e.target.value ?? '' })}
            />
          </div>

          <div className="mb-4 flex w-full max-w-sm items-center justify-between gap-3">
            <Label htmlFor="runNum" className="w-28 flex-none">
              上限方式
            </Label>
            <RadioGroup
              disabled={runing}
              className="flex items-center gap-3"
              defaultValue={setting.runType || 'sum'}
              onValueChange={value => settingStorage.setVal({ runType: value as 'sum' | 'price' })}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="sum" id="sum" />
                <Label htmlFor="sum">按次数运行</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="price" id="price" />
                <Label htmlFor="price">按积分交易额运行</Label>
              </div>
            </RadioGroup>
          </div>

          {setting.runType === 'sum' ? (
            <div className="mb-4 flex w-full max-w-sm items-center justify-between gap-3">
              <Label htmlFor="runNum" className="w-28 flex-none">
                操作次数
              </Label>
              <Input
                disabled={runing}
                key="runNum"
                type="text"
                name="runNum"
                id="runNum"
                placeholder={`操作次数`}
                defaultValue={setting.runNum ?? '1'}
                onChange={e => settingStorage.setVal({ runNum: e.target.value ?? '' })}
              />
            </div>
          ) : (
            <div className="mb-4 flex w-full max-w-sm items-center justify-between gap-3">
              <Label htmlFor="runPrice" className="w-28 flex-none">
                操作金额(USDT)
              </Label>
              <Input
                disabled={runing}
                key="runPrice"
                type="text"
                name="runPrice"
                id="runPrice"
                placeholder={`操作金额`}
                defaultValue={setting.runPrice ?? '65536'}
                onChange={e => settingStorage.setVal({ runPrice: e.target.value ?? '' })}
              />
            </div>
          )}

          <div className="mb-4 flex w-full max-w-sm items-center justify-between gap-3">
            <Label htmlFor="runNum" className="w-28 flex-none">
              随机延迟(s)
            </Label>
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
                placeholder={`最小时间(s)`}
                defaultValue={setting.minSleep ?? '1'}
                onChange={e => settingStorage.setVal({ minSleep: e.target.value ?? '' })}
              />
              <div>-</div>
              <Input
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                disabled={runing}
                spellCheck={false}
                type="text"
                name="maxAmount"
                id="maxAmount"
                placeholder={`最大时间(s)`}
                defaultValue={setting.maxSleep ?? '5'}
                onChange={e => settingStorage.setVal({ maxSleep: e.target.value ?? '' })}
              />
            </div>
          </div>

          <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4 flex w-full flex-col">
            <div className="justify-beween flex items-center gap-4">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <h4 className="text-sm font-semibold">高级设置</h4>
                  <ChevronsUpDown />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className={cn('flex flex-col gap-2', isOpen && 'mt-4')}>
              <div className="mb-2 flex flex-col gap-2">
                <div className="flex w-full max-w-sm items-center justify-between gap-3">
                  <Label htmlFor="upThreshold" className="w-28 flex-none">
                    上涨趋势确认阈值
                  </Label>
                  <Input
                    name="upThreshold"
                    id="upThreshold"
                    disabled={runing}
                    defaultValue={strategy.upThreshold ?? 2}
                    onChange={e => StategySettingStorage.setVal({ upThreshold: Number(e.target.value ?? '0') })}
                  />
                </div>
                <div className="text-xs">💹: 相关指标有（n）个达标时，视为上涨趋势</div>
              </div>
              <div className="mb-2 flex flex-col gap-2">
                <div className="flex w-full max-w-sm items-center justify-between gap-3">
                  <Label htmlFor="limit" className="w-28 flex-none">
                    k线数量
                  </Label>
                  <Input
                    name="limit"
                    id="limit"
                    disabled={runing}
                    defaultValue={strategy.limit ?? 15}
                    onChange={e => StategySettingStorage.setVal({ limit: Number(e.target.value ?? '0') })}
                  />
                </div>
                <div className="text-xs">💹: 用于判断的k线数量</div>
              </div>
              <div className="mb-2 flex flex-col gap-2">
                <div className="flex w-full max-w-sm items-center justify-between gap-3">
                  <Label htmlFor="toSlope" className="w-28 flex-none">
                    线性趋势斜率
                  </Label>
                  <Input
                    name="toSlope"
                    id="toSlope"
                    disabled={runing}
                    defaultValue={strategy.toSlope ?? 0.000001}
                    onChange={e => StategySettingStorage.setVal({ toSlope: Number(e.target.value ?? '0') })}
                  />
                </div>
                <div className="text-xs">
                  💹:
                  线性趋势斜率，设置为0则代表横盘时也可交易，这是一个曲率，一般你只需要改最后一位小数，比如0.000003，就是更严格的上涨曲线判断
                </div>
              </div>

              <div className="mb-2 flex flex-col gap-2">
                <div className="flex w-full max-w-sm items-center justify-between gap-3">
                  <Label htmlFor="toSlope" className="w-28 flex-none">
                    动量连续上升检测
                  </Label>
                  <Input
                    name="confirm"
                    id="confirm"
                    disabled={runing}
                    defaultValue={strategy.confirm ?? 3}
                    onChange={e => StategySettingStorage.setVal({ confirm: Number(e.target.value ?? '0') })}
                  />
                </div>
                <div className="text-xs">💹: 动量检测次数</div>
              </div>

              <div className="mb-2 flex flex-col gap-2">
                <div className="flex w-full max-w-sm items-center justify-between gap-3">
                  <Label htmlFor="short" className="w-28 flex-none">
                    短期均线与长期均线方向差异
                  </Label>
                  <div className="flex w-full items-center gap-2">
                    <Input
                      name="short"
                      id="short"
                      placeholder="short"
                      disabled={runing}
                      defaultValue={strategy.short ?? 5}
                      onChange={e => StategySettingStorage.setVal({ short: Number(e.target.value ?? '0') })}
                    />
                    <Input
                      name="long"
                      id="long"
                      placeholder="long"
                      disabled={runing}
                      defaultValue={strategy.long ?? 20}
                      onChange={e => StategySettingStorage.setVal({ long: Number(e.target.value ?? '0') })}
                    />
                  </div>
                </div>
                <div className="text-xs">
                  💹: 参数一： 短期均线周期，反映最近的价格趋势变化，参数二：长期均线周期，反映整体趋势方向
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div>
            <div>
              <Tabs
                defaultValue={setting.mode ?? 'Reverse'}
                className="w-full"
                onValueChange={value => settingStorage.setVal({ mode: value as 'Reverse' | 'Order' })}>
                <TabsList>
                  <TabsTrigger disabled={runing} value="Reverse">
                    反向订单
                  </TabsTrigger>
                  <TabsTrigger disabled={runing} value="Order">
                    限价单
                  </TabsTrigger>
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
                    api={setting.api || 'https://www.binance.com'}
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
                    api={setting.api || 'https://www.binance.com'}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        <div className="flex h-96 w-full flex-col gap-2 pb-4">
          <div className="flex flex-none items-center justify-between text-sm font-bold">
            <div>日志输出</div>
            <Button variant={'outline'} onClick={clearLogger}>
              清空日志
            </Button>
          </div>
          {render}
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
