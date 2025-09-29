import { useMemo, useState } from 'react';

type LogType = 'success' | 'error' | 'info';

interface LogEntry {
  type: LogType;
  msg: string;
}

export const useLogger = () => {
  const [logger, setLogger] = useState<LogEntry[]>([]);

  const appendLog = (msg: string, type: LogType = 'info') => {
    setLogger(prev => [{ msg: `[${new Date().toLocaleTimeString()}] ${msg}`, type }, ...prev]);
  };

  const clearLogger = () => setLogger([]);

  const render = useMemo(
    () => (
      <div className="min-h-0 flex-1 overflow-y-auto rounded bg-black p-2 text-xs text-green-400">
        {logger.map((line, i) => (
          <div
            key={i}
            className={
              line.type === 'error' ? 'text-red-400' : line.type === 'success' ? 'text-green-400' : 'text-gray-300'
            }>
            {line.msg}
          </div>
        ))}
      </div>
    ),
    [logger],
  );

  return {
    logger,
    render,
    appendLog,
    clearLogger,
  };
};
