import { useMemo } from 'react';

/**
 * Типы уровней логирования
 */
type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

interface Logger {
  log: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  debug: (msg: string, ...args: unknown[]) => void;
  verbose: (msg: string, ...args: unknown[]) => void;
}

const COLORS: Record<string, string> = {
  prefix: 'color: #42b883; font-weight: bold;',
  timestamp: 'color: #999;',
  context: 'color: #e6c07b;',
  log: 'color: #42b883; font-weight: bold;',
  error: 'color: #e06c75; font-weight: bold;',
  warn: 'color: #d19a66; font-weight: bold;',
  debug: 'color: #c678dd; font-weight: bold;',
  verbose: 'color: #56b6c2; font-weight: bold;',
};

const BROWSER_PID = Math.floor(Math.random() * 90000) + 10000;

const isProduction = import.meta.env ? import.meta.env.PROD : false;

// 1. Исправляем @typescript-eslint/no-empty-function
// Добавляем пустой комментарий или используем конструкцию void, чтобы linter понял, что это намеренно
const noop = () => {
  /* no-op */
};

export const useLogger = (context: string): Logger => {
  return useMemo(() => {
    if (isProduction) {
      return {
        log: noop,
        error: noop,
        warn: noop,
        debug: noop,
        verbose: noop,
      };
    }

    const print = (level: LogLevel, message: string, ...args: unknown[]) => {
      const timestamp = new Date().toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const levelLabel = level.toUpperCase().padEnd(7);

      const consoleMethodMap: Record<LogLevel, keyof Console> = {
        log: 'log',
        error: 'error',
        warn: 'warn',
        debug: 'debug',
        verbose: 'debug',
      };

      const method = consoleMethodMap[level];

      // 2. Исправляем no-console
      // Так как это сервис логирования, использование console здесь — это его прямая задача.
      // eslint-disable-next-line no-console
      const consoleFn = (console[method] as (...data: unknown[]) => void) || console.log;

      consoleFn(
        `%c[React] ${BROWSER_PID}  - %c${timestamp}    %c${levelLabel} %c[${context}] %c${message}`,
        COLORS.prefix,
        COLORS.timestamp,
        COLORS[level],
        COLORS.context,
        'color: inherit;',
        ...args,
      );
    };

    return {
      log: (msg: string, ...args: unknown[]) => print('log', msg, ...args),
      error: (msg: string, ...args: unknown[]) => print('error', msg, ...args),
      warn: (msg: string, ...args: unknown[]) => print('warn', msg, ...args),
      debug: (msg: string, ...args: unknown[]) => print('debug', msg, ...args),
      verbose: (msg: string, ...args: unknown[]) => print('verbose', msg, ...args),
    };
  }, [context]);
};
