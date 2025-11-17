export class StepsCalculator {
  static calculateDistance(steps: number): number {
    return Math.round((steps * 0.000762) * 100) / 100;
  }

  static calculateCalories(steps: number, weight?: number): number {
    if (weight) {
      const distanceKm = this.calculateDistance(steps);
      const metValue = 3.5;
      return Math.round(distanceKm * weight * metValue * 1.036);
    }
    return Math.round(steps * 0.04);
  }
}

