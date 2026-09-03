export class ClientError extends Error {
  constructor(
    message: string,
    public readonly code = 'CLIENT_ERROR',
  ) {
    super(message);
    this.name = 'ClientError';
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Request failed';
}
