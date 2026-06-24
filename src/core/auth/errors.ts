/**
 * Error thrown when authentication or authorization fails.
 */
export class AuthenticationError extends Error {
  /**
   * @param message - Human-readable error description
   * @param statusCode - HTTP status code (default 401)
   */
  constructor(
    message: string,
    public statusCode: number = 401,
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}
