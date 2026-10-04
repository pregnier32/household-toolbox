import type { ToolRemovalPlan } from './billing-cycle';

export const TOOL_REMOVAL_PRESERVATION_ERROR = "We couldn't complete this tool removal right now. Your data has not been deleted. Please try again.";

export class BillingCommitmentError extends Error {
  constructor() {
    super(TOOL_REMOVAL_PRESERVATION_ERROR);
    this.name = 'BillingCommitmentError';
  }
}

/** Tool data is deleted only after a paid billing-period line has been saved. */
export async function deleteAfterBillingCommitment<T>(args: {
  plan: ToolRemovalPlan;
  toolId: string;
  preserve: () => Promise<void>;
  deleteData: () => Promise<T>;
}): Promise<T> {
  if (args.plan.kind === 'schedule') {
    const marked = args.plan.tools.some((record) => record.toolId === args.toolId && record.scheduledRemoval);
    if (!marked) {
      console.error('Paid tool removal had no billing-period line to preserve.', args.toolId);
      throw new BillingCommitmentError();
    }
    try {
      await args.preserve();
    } catch (error) {
      console.error('Billing period commitment could not be saved before tool removal:', error);
      if (error instanceof BillingCommitmentError) throw error;
      throw new BillingCommitmentError();
    }
  }
  return args.deleteData();
}
