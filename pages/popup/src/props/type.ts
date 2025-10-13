export interface IPanelProps {
  setCurrentBalance: (balance: string) => void;
  startBalance: string;
  setStartBalance: (balance: string) => void;
  runing: boolean;
  setRuning: (runing: boolean) => void;
  appendLog: (msg: string, type: 'success' | 'error' | 'info') => void;
  setNum: (num: number) => void;
  api: string;
}
