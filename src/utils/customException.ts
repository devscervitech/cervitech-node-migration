export class CustomException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomException";

    
    Object.setPrototypeOf(this, CustomException.prototype);
  }
}
