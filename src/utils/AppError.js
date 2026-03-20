export class AppError extends Error {
  /**
   * @param {number} statusCode HTTP status
   * @param {string} message Safe client-facing message
   */
  constructor(statusCode, message) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}
