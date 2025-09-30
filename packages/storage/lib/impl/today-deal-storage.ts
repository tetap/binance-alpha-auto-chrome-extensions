import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

// eslint-disable-next-line import-x/exports-last
export type TodayDealStateType = Record<string, string>;

// eslint-disable-next-line import-x/exports-last
export type TodayDealType = BaseStorageType<TodayDealStateType> & {
  setVal: (day: string, val: string) => Promise<void>;
};

const storage = createStorage<TodayDealStateType>(
  'today-deal-storage-key',
  {},
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const todayDealStorage: TodayDealType = {
  ...storage,
  setVal: async (day, val) => {
    await storage.set(currentState => ({
      ...currentState,
      [day]: (currentState[day] ? Number(currentState[day]) + Number(val) : val).toString(),
    }));
  },
};
