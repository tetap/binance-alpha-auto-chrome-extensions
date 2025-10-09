import { createStorage, StorageEnum } from '../base/index.js';
import deepmerge from 'deepmerge';
import type { BaseStorageType } from '../base/index.js';

// eslint-disable-next-line import-x/exports-last
export type OrderSettingState = {
  amount: string;
  timeout: string;
  runNum: string;
  count: string;
  // 卖出超时次数(超出次数将以最佳价格卖出止损)
  timeoutCount: string;
  // 下单金额模式 固定金额 随机金额
  orderAmountMode: 'Fixed' | 'Random';
  // 最高随机金额
  maxAmount: string;
  // 最低随机金额
  minAmount: string;
};

// eslint-disable-next-line import-x/exports-last
export type OrderSettingType = BaseStorageType<OrderSettingState> & {
  setVal: (val: Partial<OrderSettingState>) => Promise<void>;
};

const storage = createStorage<OrderSettingState>(
  'order-setting-storage-key',
  {
    amount: '',
    timeout: '2',
    runNum: '3',
    count: '1',
    timeoutCount: '1',
    orderAmountMode: 'Fixed',
    maxAmount: '100',
    minAmount: '50',
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const orderSettingStorage: OrderSettingType = {
  ...storage,
  setVal: async (val: Partial<OrderSettingState>) => {
    await storage.set(currentState => deepmerge(currentState, val));
  },
};
