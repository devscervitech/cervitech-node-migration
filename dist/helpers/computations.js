// helpers/computations/calculator.ts
export function getCraniumVertebralAngleFromNeckAngle(neckAngle) {
    let craniumVertebralAngle = neckAngle - 40;
    if (craniumVertebralAngle < 0) {
        craniumVertebralAngle = 0;
    }
    return craniumVertebralAngle;
}
