export interface IRerverseModeProps {
  setCurrentBalance: (balance: string) => void;
  startBalance: string;
  setStartBalance: (balance: string) => void;
  runing: boolean;
  setRuning: (runing: boolean) => void;
  appendLog: (msg: string, type: 'success' | 'error' | 'info') => void;
}

// export const OrderMode = ({
//   setCurrentBalance,
//   setStartBalance,
//   startBalance,
//   runing,
//   setRuning,
//   appendLog,
// }: IRerverseModeProps) => {
//   return <div>123</div>;
// };
