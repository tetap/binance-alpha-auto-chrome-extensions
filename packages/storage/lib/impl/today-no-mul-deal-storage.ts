import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

// eslint-disable-next-line import-x/exports-last
export type TodayNoMulDealStateType = Record<string, string>;

// eslint-disable-next-line import-x/exports-last
export type TodayNoMulDealType = BaseStorageType<TodayNoMulDealStateType> & {
  setVal: (day: string, val: string) => Promise<void>;
  getVal: (day: string) => Promise<string>;
};

const storage = createStorage<TodayNoMulDealStateType>(
  'today-mo-mul-deal-storage-key-v1',
  {},
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const todayNoMulDealStorage: TodayNoMulDealType = {
  ...storage,
  setVal: async (day, val) => {
    await storage.set(currentState => ({
      ...currentState,
      [day]: (currentState[day] ? Number(currentState[day]) + Number(val) : val).toString(),
    }));
  },
  getVal: async (day: string) => {
    const store = await storage.get();
    const val = store[day];
    return val;
  },
};
