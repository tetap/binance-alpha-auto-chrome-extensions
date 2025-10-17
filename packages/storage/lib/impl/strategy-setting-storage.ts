import { createStorage, StorageEnum } from '../base/index.js';
import deepmerge from 'deepmerge';
import type { BaseStorageType } from '../base/index.js';

// eslint-disable-next-line import-x/exports-last
export type StategySettingStateType = {
  toSlope: number;
  confirm: number;
  short: number;
  long: number;
  lookback: number;
  limit: number;
  upThreshold: number;
};

// eslint-disable-next-line import-x/exports-last
export type StategySettingType = BaseStorageType<StategySettingStateType> & {
  setVal: (val: Partial<StategySettingStateType>) => Promise<void>;
};

const storage = createStorage<StategySettingStateType>(
  'stategy-setting-key-v0',
  {
    toSlope: 0.000001,
    confirm: 3,
    short: 5,
    long: 20,
    lookback: 15,
    limit: 15,
    upThreshold: 2,
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const StategySettingStorage: StategySettingType = {
  ...storage,
  setVal: async (val: Partial<StategySettingStateType>) => {
    await storage.set(currentState => deepmerge(currentState, val));
  },
};
