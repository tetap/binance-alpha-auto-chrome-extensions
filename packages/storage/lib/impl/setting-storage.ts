import { createStorage, StorageEnum } from '../base/index.js';
import deepmerge from 'deepmerge';
import type { BaseStorageType } from '../base/index.js';

// eslint-disable-next-line import-x/exports-last
export type SettingState = {
  amount: string;
  timeout: string;
  runNum: string;
  count: string;
  dot: string;
  type: 'Buy' | 'Sell';
};

// eslint-disable-next-line import-x/exports-last
export type SettingType = BaseStorageType<SettingState> & {
  setVal: (val: Partial<SettingState>) => Promise<void>;
};

const storage = createStorage<SettingState>(
  'setting-storage-key',
  {
    amount: '',
    timeout: '3',
    runNum: '3',
    count: '3',
    dot: '3',
    type: 'Buy',
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
