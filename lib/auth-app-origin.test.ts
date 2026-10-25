import assert from 'node:assert/strict';
import test from 'node:test';
import { planBillingReturnUrl, resumeAfterAuth } from './auth-app-origin';

function setNodeEnv(value: string | undefined) {
  (process.env as { NODE_ENV?: string }).NODE_ENV = value;
}

test('local portal return uses the trusted localhost plan page', () => {
  const previous = process.env.NODE_ENV;
  setNodeEnv('development');
  try {
    assert.equal(planBillingReturnUrl(), 'http://localhost:3000/dashboard/plan');
  } finally {
    setNodeEnv(previous);
  }
});

test('production portal return uses the www plan page', () => {
  const previous = process.env.NODE_ENV;
  const previousVercel = process.env.VERCEL_ENV;
  setNodeEnv('production');
  delete process.env.VERCEL_ENV;
  try {
    assert.equal(planBillingReturnUrl(), 'https://www.householdtoolbox.com/dashboard/plan');
  } finally {
    setNodeEnv(previous);
    if (previousVercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercel;
  }
});

test('preview auth and portal return stay on the preview host', () => {
  const previousEnv = process.env.VERCEL_ENV;
  const previousUrl = process.env.VERCEL_URL;
  process.env.VERCEL_ENV = 'preview';
  process.env.VERCEL_URL = 'household-toolbox-preview.vercel.app';
  try {
    assert.equal(planBillingReturnUrl(), 'https://household-toolbox-preview.vercel.app/dashboard/plan');
  } finally {
    if (previousEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousEnv;
    if (previousUrl === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = previousUrl;
  }
});

test('sign-in and MFA can resume Plan and Billing and reject another destination', () => {
  assert.equal(resumeAfterAuth('/dashboard/plan'), '/dashboard/plan');
  assert.equal(resumeAfterAuth('/invite/abc'), '/invite/abc');
  assert.equal(resumeAfterAuth('https://evil.example/dashboard/plan'), '/dashboard');
  assert.equal(resumeAfterAuth('//evil.example/dashboard/plan'), '/dashboard');
  assert.equal(resumeAfterAuth('/dashboard/plan?next=https://evil.example'), '/dashboard');
  assert.equal(resumeAfterAuth('/dashboard/plan/access'), '/dashboard');
  assert.equal(resumeAfterAuth('/dashboard'), '/dashboard');
  assert.equal(resumeAfterAuth(null), '/dashboard');
});
