import { ConvexError } from 'convex/values';

interface ConvexErrorData {
  code: string;
  message: string;
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof ConvexError) {
    const data = err.data as ConvexErrorData;
    return data.message ?? '';
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export function getErrorCode(err: unknown): string | null {
  if (err instanceof ConvexError) {
    const data = err.data as ConvexErrorData;
    return data.code ?? null;
  }
  return null;
}
