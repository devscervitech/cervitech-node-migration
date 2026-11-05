export class CustomException extends Error {
    constructor(message) {
        super(message);
        this.name = "CustomException";
        Object.setPrototypeOf(this, CustomException.prototype);
    }
}
