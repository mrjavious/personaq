import { prisma } from '@/lib/db';
import { ImageProviderError } from './image-provider';

export interface UsageRecordInput {
  provider: string;
  model: string;
  kind: 'image' | 'vision_safety' | 'consistency' | 'caption' | 'reply' | string;
  estimatedCost?: number;
  personaId?: string | null;
}

export const DEFAULT_ESTIMATED_COSTS: Record<string, number> = {
  image: 0.04,
  vision_safety: 0.005,
  consistency: 0.005,
  caption: 0.001,
  reply: 0.001,
};

export function getMonthlyBudgetCap(): number {
  const envVal = process.env.MONTHLY_BUDGET_CAP;
  if (!envVal) return 50.0;
  const parsed = parseFloat(envVal);
  return isNaN(parsed) ? 50.0 : parsed;
}

export function getStartOfCurrentMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

export async function getCurrentMonthlySpend(now = new Date()): Promise<number> {
  const startOfMonth = getStartOfCurrentMonth(now);

  const aggregate = await prisma.usageLedger.aggregate({
    _sum: {
      estimatedCost: true,
    },
    where: {
      createdAt: {
        gte: startOfMonth,
      },
    },
  });

  return aggregate._sum.estimatedCost || 0.0;
}

export async function checkBudget(estimatedCost = 0.04): Promise<{
  allowed: boolean;
  currentSpent: number;
  cap: number;
  remaining: number;
}> {
  const cap = getMonthlyBudgetCap();
  const currentSpent = await getCurrentMonthlySpend();
  const projected = currentSpent + estimatedCost;
  const remaining = Math.max(0, cap - currentSpent);
  const allowed = projected <= cap;

  return {
    allowed,
    currentSpent: Math.round(currentSpent * 1000) / 1000,
    cap,
    remaining: Math.round(remaining * 1000) / 1000,
  };
}

export async function assertWithinBudget(estimatedCost = 0.04): Promise<void> {
  const status = await checkBudget(estimatedCost);
  if (!status.allowed) {
    throw new ImageProviderError(
      'quota',
      `Monthly AI generation budget exceeded: current spend is $${status.currentSpent.toFixed(2)}, budget cap is $${status.cap.toFixed(2)}`
    );
  }
}

export async function recordUsage(input: UsageRecordInput) {
  const cost =
    input.estimatedCost !== undefined
      ? input.estimatedCost
      : DEFAULT_ESTIMATED_COSTS[input.kind] || 0.01;

  return prisma.usageLedger.create({
    data: {
      provider: input.provider,
      model: input.model,
      kind: input.kind,
      estimatedCost: cost,
      personaId: input.personaId || null,
    },
  });
}
