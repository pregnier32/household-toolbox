import { randomUUID } from 'node:crypto';
import { supabaseServer } from '@/lib/supabaseServer';

type RpcClient = {
  rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function rpcClient(): RpcClient {
  return supabaseServer as unknown as RpcClient;
}

/**
 * The server talks to Postgres through the Supabase service-role HTTP client.
 * Each request is its own transaction, so a session advisory lock would release
 * before the following Stripe call. The lock is a lease row updated by one
 * database function. A crashed worker's lease expires and the next caller can
 * claim it.
 */
export async function claimBillingLock(userId: string, owner: string = randomUUID(), seconds = 120): Promise<string | null> {
  const { data, error } = await rpcClient().rpc('claim_billing_lock', {
    p_user_id: userId,
    p_owner: owner,
    p_seconds: seconds,
  });
  if (error) throw error;
  return data === true ? owner : null;
}

export async function releaseBillingLock(userId: string, owner: string): Promise<void> {
  const { error } = await rpcClient().rpc('release_billing_lock', {
    p_user_id: userId,
    p_owner: owner,
  });
  if (error) throw error;
}

export async function withBillingLock<T>(userId: string, work: () => Promise<T>): Promise<T> {
  const owner = await claimBillingLock(userId);
  if (!owner) throw new Error('Billing account is already being updated.');
  try {
    return await work();
  } finally {
    await releaseBillingLock(userId, owner);
  }
}

export type StripeEventClaim = 'claimed' | 'completed' | 'busy';

export async function claimStripeEvent(input: {
  eventId: string;
  type: string;
  livemode: boolean;
  payload: unknown;
  owner?: string;
  seconds?: number;
}): Promise<{ claim: StripeEventClaim; owner: string }> {
  const owner = input.owner ?? randomUUID();
  const { data, error } = await rpcClient().rpc('claim_stripe_event', {
    p_event_id: input.eventId,
    p_type: input.type,
    p_livemode: input.livemode,
    p_owner: owner,
    p_seconds: input.seconds ?? 120,
    p_payload: input.payload,
  });
  if (error) throw error;
  const claim = data === 'claimed' || data === 'completed' || data === 'busy' ? data : 'busy';
  return { claim, owner };
}

export async function finishStripeEvent(eventId: string, owner: string, status: 'completed' | 'failed', errorMessage: string | null): Promise<boolean> {
  const { data, error } = await rpcClient().rpc('finish_stripe_event', {
    p_event_id: eventId,
    p_owner: owner,
    p_status: status,
    p_error: errorMessage,
  });
  if (error) throw error;
  return data === true;
}
