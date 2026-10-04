export class ApiError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: unknown;

  constructor(statusCode: number, message: string, code?: string, details?: unknown);
  constructor(code: string, message: string, statusCode: number, details?: unknown);
  constructor(
    first: number | string,
    second: string,
    third?: string | number,
    fourth?: unknown
  ) {
    super(second);
    this.name = 'ApiError';
    if (typeof first === 'number') {
      this.statusCode = first;
      this.code = typeof third === 'string' ? third : undefined;
      this.details = fourth;
    } else {
      this.code = first;
      this.statusCode = typeof third === 'number' ? third : 400;
      this.details = fourth;
    }
  }
}
