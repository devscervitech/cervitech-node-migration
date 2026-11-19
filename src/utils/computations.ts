// helpers/computations/calculator.ts

export function getCraniumVertebralAngleFromNeckAngle(neckAngle: number): number {
  let craniumVertebralAngle = neckAngle - 40;
  if (craniumVertebralAngle < 0) {
    craniumVertebralAngle = 0;
  }
  return craniumVertebralAngle;
}