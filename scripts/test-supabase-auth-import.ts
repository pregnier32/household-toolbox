/**
 * Retired one-user Supabase Auth import.
 *
 * Creating an Auth user from a public.users password hash is no longer supported.
 * --rollback still deletes only a matching Auth user and leaves public.users in place.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createInterface } from 'node:readline'
import { stdin, stdout } from 'node:process'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const OWNED_TABLES = [
  'users_tools',
  'user_tool_entitlements',
  'calendar_pins',
  'tools_note_notes',
  'tools_id_documents',
  'tools_sl_lists',
  'tools_eolp_plans',
] as const

const STORAGE_BUCKETS = [
  'address-book',
  'calendar-events',
  'cleaning-schedule',
  'end-of-life-planner',
  'event-budget-planner',
  'goals-tracking',
  'healthcare-appt-history',
  'home-maintenance-schedule',
  'hsa-tracker',
  'important-documents',
  'meal-planner',
  'notes',
  'pet-care-schedule',
  'repair-history',
  'shopping-list',
  'subscription-tracker',
  'to-do-list',
  'travel-log',
] as const

type AppUser = {
  id: string
  email: string
  active: string
  user_status: string
}

type Baseline = {
  tables: Record<string, number>
  storageObjects: number
}

type Check = boolean | 'na'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const secrets: string[] = []

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split(/\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    if (key === 'AUTH_TEST_PASSWORD') continue
    if (process.env[key] !== undefined) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

function trackSecret(value: string | undefined) {
  if (value && value.length > 8) secrets.push(value)
}

function redact(message: string): string {
  let out = message
  for (const secret of secrets) {
    out = out.split(secret).join('[secret]')
  }
  return out
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[token]')
    .replace(/\$2[aby]\$[0-9]{2}\$[^\s'"]+/g, '[hash]')
}

function fail(message: string): never {
  console.error(redact(message))
  process.exit(1)
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***'
  return `${local.slice(0, 1)}***@${domain}`
}

function report(label: string, value: Check) {
  const text = value === 'na' ? 'NOT APPLICABLE' : value ? 'PASS' : 'FAIL'
  console.log(`${label}:`)
  console.log(text)
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) fail(`Missing ${name}. This script reads it on the server and does not print it.`)
  trackSecret(value)
  return value
}

function parseArgs(argv: string[]) {
  let email: string | undefined
  let id: string | undefined
  let rollback: string | undefined
  let allowSuperadmin = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]
    if (arg === '--email' && next) {
      email = next.trim().toLowerCase()
      i++
    } else if (arg === '--id' && next) {
      id = next.trim()
      i++
    } else if (arg === '--rollback' && next) {
      rollback = next.trim()
      i++
    } else if (arg === '--allow-superadmin') {
      allowSuperadmin = true
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      fail(`Unknown argument ${arg}. Run with --help.`)
    }
  }
  const selectors = [email, id, rollback].filter(Boolean).length
  if (selectors !== 1) {
    printHelp()
    fail('Provide exactly one of --email, --id, or --rollback.')
  }
  return { email, id, rollback, allowSuperadmin }
}

function printHelp() {
  console.log(`Supabase Auth import is retired.

  npm run auth:test-import -- --rollback <public.users.id>
  npm run auth:test-import -- --rollback <public.users.id> --allow-superadmin

Rollback deletes only the matching Auth user. It does not change public.users.`)
}

function ask(question: string): Promise<string> {
  if (!stdin.isTTY) {
    return Promise.reject(new Error('A terminal is required so this script cannot run unattended.'))
  }
  const rl = createInterface({ input: stdin, output: stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function confirmExact(expected: string) {
  let answer = ''
  try {
    answer = await ask(`Type ${expected} to continue: `)
  } catch (error) {
    fail(error instanceof Error ? error.message : 'Confirmation failed.')
  }
  if (answer !== expected) fail('Confirmation did not match. No changes were made.')
}

function adminClient() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function loadAppUser(supabase: SupabaseClient, selector: { email?: string; id?: string }): Promise<AppUser> {
  let query = supabase.from('users').select('id, email, active, user_status')
  query = selector.id ? query.eq('id', selector.id) : query.eq('email', selector.email!)
  const { data, error } = await query.maybeSingle()
  if (error) fail(`Could not read public.users: ${redact(error.message)}`)
  if (!data) fail('No public.users row matched that email or id.')
  return data as AppUser
}

function assertCandidate(user: AppUser, allowSuperadmin: boolean) {
  if (!UUID_V4.test(user.id)) fail('public.users.id is not a UUID v4. Stopped.')
  if (!user.email?.trim()) fail('The user has no email. Stopped.')
  if (user.active !== 'Y') fail('The user is not active. Stopped.')
  if (user.user_status === 'superadmin' && !allowSuperadmin) {
    fail('Refusing to test the superadmin account. Pass --allow-superadmin to import this account.')
  }
  if (user.user_status !== 'admin' && user.user_status !== 'superadmin') {
    fail(`Refusing user_status ${user.user_status}. Only admin is allowed.`)
  }
}

async function countTable(supabase: SupabaseClient, table: string, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) fail(`Could not count ${table}: ${redact(error.message)}`)
  return count ?? 0
}

async function countStorage(supabase: SupabaseClient, userId: string): Promise<number> {
  let total = 0
  for (const bucket of STORAGE_BUCKETS) {
    total += await countStoragePrefix(supabase, bucket, userId, '')
  }
  return total
}

async function countStoragePrefix(
  supabase: SupabaseClient,
  bucket: string,
  userId: string,
  prefix: string,
  depth = 0
): Promise<number> {
  if (depth > 6) return 0
  let total = 0
  let offset = 0
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 100, offset })
    if (error) fail(`Could not list storage bucket ${bucket}: ${redact(error.message)}`)
    const entries = data ?? []
    for (const entry of entries) {
      const child = prefix ? `${prefix}/${entry.name}` : entry.name
      const isFile = Boolean(entry.id)
      if (isFile) {
        if (child.split('/').includes(userId)) total += 1
      } else {
        total += await countStoragePrefix(supabase, bucket, userId, child, depth + 1)
      }
    }
    if (entries.length < 100) break
    offset += 100
  }
  return total
}

async function snapshot(supabase: SupabaseClient, userId: string): Promise<Baseline> {
  const tables: Record<string, number> = {}
  for (const table of OWNED_TABLES) {
    tables[table] = await countTable(supabase, table, userId)
  }
  return { tables, storageObjects: await countStorage(supabase, userId) }
}

function printSummary(user: AppUser, baseline: Baseline) {
  console.log('Candidate')
  console.log(`masked email: ${maskEmail(user.email)}`)
  console.log(`user id: ${user.id}`)
  console.log(`user_status: ${user.user_status}`)
  console.log(`active: ${user.active}`)
  console.log(`users_tools rows: ${baseline.tables.users_tools}`)
  console.log(`storage objects: ${baseline.storageObjects}`)
}

async function getAuthUser(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.auth.admin.getUserById(id)
  if (error) {
    if (error.status === 404 || /not found/i.test(error.message)) return null
    fail(`Could not read Auth user: ${redact(error.message)}`)
  }
  return data.user
}

async function runImport() {
  fail(
    'Account password import is retired. Supabase Auth is the only account credential store. No Auth user was created.'
  )
}

async function runRollback(userId: string, allowSuperadmin: boolean) {
  if (!UUID_V4.test(userId)) fail('Rollback id is not a UUID v4. No changes were made.')
  const supabase = adminClient()
  const user = await loadAppUser(supabase, { id: userId })
  assertCandidate(user, allowSuperadmin)
  const authUser = await getAuthUser(supabase, user.id)
  if (!authUser) {
    fail(`No Auth user exists for ${user.id}. public.users was not changed.`)
  }
  if (authUser.email?.toLowerCase() !== user.email.toLowerCase()) {
    fail('Auth email does not match public.users. Rollback stopped so the wrong Auth user is not deleted.')
  }
  const baseline = await snapshot(supabase, user.id)
  printSummary(user, baseline)
  console.log('Rollback deletes only the Supabase Auth user.')
  await confirmExact('DELETE AUTH USER')

  const deleted = await supabase.auth.admin.deleteUser(user.id, false)
  if (deleted.error) fail(`Auth delete failed: ${redact(deleted.error.message)}`)

  const stillAuth = await getAuthUser(supabase, user.id)
  const stillApp = await loadAppUser(supabase, { id: user.id })
  const after = await snapshot(supabase, user.id)
  const profileRemains =
    stillApp.id === user.id && stillApp.email === user.email && stillApp.active === user.active
  report('Auth user removed', stillAuth === null)
  report('public.users still exists', profileRemains)
  const dataSame =
    OWNED_TABLES.every((table) => after.tables[table] === baseline.tables[table]) &&
    after.storageObjects === baseline.storageObjects
  report('Existing application data unchanged', dataSame)
  if (stillAuth || !profileRemains || !dataSame) process.exitCode = 1
}

async function main() {
  loadEnvFile(resolve(root, '.env.local'))
  const args = parseArgs(process.argv.slice(2))
  if (args.rollback) await runRollback(args.rollback, args.allowSuperadmin)
  else await runImport()
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unexpected failure'
  fail(redact(message))
})
