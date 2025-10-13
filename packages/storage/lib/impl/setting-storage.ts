import { createStorage, StorageEnum } from '../base/index.js';
import deepmerge from 'deepmerge';
import type { BaseStorageType } from '../base/index.js';

// eslint-disable-next-line import-x/exports-last
export type SettingState = {
  amount: string;
  timeout: string;
  // 上限方式
  runType: 'sum' | 'price';
  runNum: string;
  runPrice: string;
  count: string;
  dot: string;
  type: 'Buy' | 'Sell';
  mode: 'Reverse' | 'Order';
  // 卖出超时次数(超出次数将以最佳价格卖出止损)
  timeoutCount: string;
  // 下单金额模式 固定金额 随机金额
  orderAmountMode: 'Fixed' | 'Random';
  // 最高随机金额
  maxAmount: string;
  // 最低随机金额
  minAmount: string;
  // 二次验证(secret)
  secret: string;
  // api地址
  api: string;
};

// eslint-disable-next-line import-x/exports-last
export type SettingType = BaseStorageType<SettingState> & {
  setVal: (val: Partial<SettingState>) => Promise<void>;
};

const storage = createStorage<SettingState>(
  'setting-storage-key',
  {
    amount: '',
    timeout: '2',
    runNum: '3',
    runPrice: '65536',
    count: '1',
    dot: '3',
    type: 'Buy',
    mode: 'Reverse',
    timeoutCount: '3',
    orderAmountMode: 'Fixed',
    maxAmount: '100',
    minAmount: '50',
    secret: '',
    api: 'https://www.binance.com',
    runType: 'sum',
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const settingStorage: SettingType = {
  ...storage,
  setVal: async (val: Partial<SettingState>) => {
    await storage.set(currentState => deepmerge(currentState, val));
  },
};
