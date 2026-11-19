// helpers/Calculator.ts

export class Calculator {
  static getCraniumVertebralAngleFromNeckAngle(neckAngle: number): number {
    try {
      let craniumVertebralAngle = neckAngle - 40;
      if (craniumVertebralAngle < 0) {
        craniumVertebralAngle = 0;
      }
      return craniumVertebralAngle;
    } catch (error) {
      throw error;
    }
  }
}
