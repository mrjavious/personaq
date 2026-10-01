import { createWriteStream } from 'fs';
import { join } from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

const LOG_DIR = join(process.cwd(), 'logs');
const isDevelopment = process.env.NODE_ENV === 'development';

// Simple file-based logger (replace with Pino in production)
class Logger {
  private stream: ReturnType<typeof createWriteStream> | null = null;

  private getStream() {
    if (!this.stream && !isDevelopment) {
      const date = new Date().toISOString().split('T')[0];
      this.stream = createWriteStream(join(LOG_DIR, `app-${date}.log`), { flags: 'a' });
    }
    return this.stream;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    if (isDevelopment) {
      const color = {
        debug: '\x1b[36m',
        info: '\x1b[32m',
        warn: '\x1b[33m',
        error: '\x1b[31m',
      }[level];
      console.log(`${color}[${level.toUpperCase()}]\x1b[0m ${message}`, context ? JSON.stringify(context) : '');
    } else {
      const stream = this.getStream();
      if (stream) {
        stream.write(JSON.stringify(entry) + '\n');
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.log('error', message, context);
  }
}

export const logger = new Logger();
