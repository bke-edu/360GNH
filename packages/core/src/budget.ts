import type { BudgetSnapshot, ModelUsage } from './types.js';

export class BudgetExceededError extends Error {
  override readonly name = 'BudgetExceededError';
}

export class UsageBudget {
  readonly #limitUsd: number;
  #spentUsd = 0;
  #calls = 0;
  readonly #reservations = new Map<symbol, number>();

  constructor(limitUsd: number) {
    if (!Number.isFinite(limitUsd) || limitUsd < 0) {
      throw new RangeError('Budget limit must be a non-negative finite number');
    }
    this.#limitUsd = limitUsd;
  }

  assertCanSpend(estimatedCostUsd: number): void {
    assertCost(estimatedCostUsd, 'Estimated cost');
    if (this.#spentUsd + this.reservedTotal() + estimatedCostUsd > this.#limitUsd) {
      throw new BudgetExceededError(
        `Estimated call cost $${estimatedCostUsd.toFixed(6)} exceeds remaining budget $${this.snapshot().remainingUsd.toFixed(6)}`,
      );
    }
  }

  reserve(estimatedCostUsd: number): symbol {
    assertCost(estimatedCostUsd, 'Estimated cost');
    const available = this.#limitUsd - this.#spentUsd - this.reservedTotal();
    if (estimatedCostUsd > available + Number.EPSILON) {
      throw new BudgetExceededError(
        `Estimated call cost $${estimatedCostUsd.toFixed(6)} exceeds unreserved budget $${Math.max(0, available).toFixed(6)}`,
      );
    }
    const reservation = Symbol('usage-budget-reservation');
    this.#reservations.set(reservation, estimatedCostUsd);
    return reservation;
  }

  release(reservation: symbol): void {
    if (!this.#reservations.delete(reservation)) {
      throw new Error('Unknown or already settled budget reservation');
    }
  }

  settle(reservation: symbol, usage: ModelUsage): BudgetSnapshot {
    assertCost(usage.estimatedCostUsd, 'Usage cost');
    const reserved = this.#reservations.get(reservation);
    if (reserved === undefined) throw new Error('Unknown or already settled budget reservation');
    this.#reservations.delete(reservation);
    this.#spentUsd += usage.estimatedCostUsd;
    this.#calls += 1;
    if (
      usage.estimatedCostUsd > reserved + Number.EPSILON ||
      this.#spentUsd > this.#limitUsd + Number.EPSILON
    ) {
      throw new BudgetExceededError(
        `Settled model usage exceeded its reservation or configured budget ($${usage.estimatedCostUsd.toFixed(6)} actual, $${reserved.toFixed(6)} reserved)`,
      );
    }
    return this.snapshot();
  }

  record(usage: ModelUsage): BudgetSnapshot {
    assertCost(usage.estimatedCostUsd, 'Usage cost');
    this.assertCanSpend(usage.estimatedCostUsd);
    this.#spentUsd += usage.estimatedCostUsd;
    this.#calls += 1;
    return this.snapshot();
  }

  snapshot(): BudgetSnapshot {
    const reservedUsd = this.reservedTotal();
    return {
      limitUsd: this.#limitUsd,
      spentUsd: Number(this.#spentUsd.toFixed(8)),
      reservedUsd: Number(reservedUsd.toFixed(8)),
      remainingUsd: Number(Math.max(0, this.#limitUsd - this.#spentUsd - reservedUsd).toFixed(8)),
      calls: this.#calls,
    };
  }

  private reservedTotal(): number {
    let total = 0;
    for (const value of this.#reservations.values()) total += value;
    return total;
  }
}

function assertCost(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number`);
  }
}
