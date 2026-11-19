// exceptions/CustomException.ts

export default class CustomException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomException';

    // For correct prototype chain
    Object.setPrototypeOf(this, CustomException.prototype);
  }
}