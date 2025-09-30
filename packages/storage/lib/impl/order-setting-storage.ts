import { createStorage, StorageEnum } from '../base/index.js';
import deepmerge from 'deepmerge';
import type { BaseStorageType } from '../base/index.js';

// eslint-disable-next-line import-x/exports-last
export type OrderSettingState = {
  amount: string;
  timeout: string;
  runNum: string;
  count: string;
  dot: string;
  type: 'Buy' | 'Sell';
  // 卖出超时次数(超出次数将以最佳价格卖出止损)
  timeoutCount: string;
};

// eslint-disable-next-line import-x/exports-last
export type OrderSettingType = BaseStorageType<OrderSettingState> & {
  setVal: (val: Partial<OrderSettingState>) => Promise<void>;
};

const storage = createStorage<OrderSettingState>(
  'order-setting-storage-key',
  {
    amount: '',
    timeout: '3',
    runNum: '3',
    count: '3',
    dot: '3',
    type: 'Sell',
    timeoutCount: '2',
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
