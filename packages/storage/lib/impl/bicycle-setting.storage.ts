import { createStorage, StorageEnum } from '../base/index.js';
import deepmerge from 'deepmerge';
import type { BaseStorageType } from '../base/index.js';

// eslint-disable-next-line import-x/exports-last
export type BicycleSettingState = {
  amount: string;
  runNum: string;
  count: string;
  // 下单金额模式 固定金额 随机金额
  orderAmountMode: 'Fixed' | 'Random';
  // 最高随机金额
  maxAmount: string;
  // 最低随机金额
  minAmount: string;
  // 检查价格时间
  checkPriceTime: string;
  // 检查次数
  checkPriceCount: string;
};

// eslint-disable-next-line import-x/exports-last
export type BicycleSettingType = BaseStorageType<BicycleSettingState> & {
  setVal: (val: Partial<BicycleSettingState>) => Promise<void>;
};

const storage = createStorage<BicycleSettingState>(
  'bicycle-setting-storage-key',
  {
    amount: '',
    runNum: '3',
    count: '3',
    orderAmountMode: 'Fixed',
    maxAmount: '100',
    minAmount: '50',
    checkPriceTime: '1',
    checkPriceCount: '60',
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const bicycleSettingStorage: BicycleSettingType = {
  ...storage,
  setVal: async (val: Partial<BicycleSettingState>) => {
    await storage.set(currentState => deepmerge(currentState, val));
  },
};
