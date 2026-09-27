/**
 * Manual one-user Supabase Auth import proof.
 *
 * Creates a single auth.users row for an existing public.users account.
 * Does not change Household Toolbox login, public.users, tool rows, or storage.
 *
 * Run only by hand:
 *   npm run auth:test-import -- --email you@example.com
 *   npm run auth:test-import -- --id <public.users.id>
 *   npm run auth:test-import -- --rollback <public.users.id>
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createInterface } from 'node:readline'
import { stdin, stdout } from 'node:process'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const BCRYPT_2B = /^\$2b\$[0-9]{2}\$/

const OWNED_TABLES = [
  'users_tools',
  'user_tool_entitlements',
  'calendar_pins',
  'password_reset_tokens',
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
  password: string
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
  return { email, id, rollback }
}

function printHelp() {
  console.log(`Manual Supabase Auth import test.

  npm run auth:test-import -- --email you@example.com
  npm run auth:test-import -- --id <public.users.id>
  npm run auth:test-import -- --rollback <public.users.id>

The password is requested in a hidden prompt, or taken from AUTH_TEST_PASSWORD
for this process only. Do not put that variable in .env.local.`)
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

function askHidden(question: string): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('No terminal for a hidden prompt.'))
  }
  return new Promise((resolve) => {
    stdout.write(question)
    stdin.setRawMode(true)
    stdin.resume()
    let value = ''
    const onData = (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      if (text === '\u0003') {
        cleanup()
        process.exit(1)
      }
      if (text === '\r' || text === '\n') {
        cleanup()
        stdout.write('\n')
        resolve(value)
        return
      }
      if (text === '\u007f' || text === '\b') {
        value = value.slice(0, -1)
        return
      }
      if (text >= ' ') value += text
    }
    const cleanup = () => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.off('data', onData)
    }
    stdin.on('data', onData)
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

function anonClient() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function loadAppUser(supabase: SupabaseClient, selector: { email?: string; id?: string }): Promise<AppUser> {
  let query = supabase.from('users').select('id, email, active, user_status, password')
  query = selector.id ? query.eq('id', selector.id) : query.eq('email', selector.email!)
  const { data, error } = await query.maybeSingle()
  if (error) fail(`Could not read public.users: ${redact(error.message)}`)
  if (!data) fail('No public.users row matched that email or id.')
  return data as AppUser
}

function assertCandidate(user: AppUser) {
  if (!UUID_V4.test(user.id)) fail('public.users.id is not a UUID v4. Stopped.')
  if (!user.email?.trim()) fail('The user has no email. Stopped.')
  if (user.active !== 'Y') fail('The user is not active. Stopped.')
  if (user.user_status === 'superadmin') fail('Refusing to test the superadmin account.')
  if (user.user_status !== 'admin') fail(`Refusing user_status ${user.user_status}. Only admin is allowed.`)
  if (!user.password) fail('The user has no password hash. Stopped.')
  if (!BCRYPT_2B.test(user.password) || user.password.length !== 60) {
    fail('The password hash is not a 60-character bcrypt $2b$ hash. Stopped.')
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
  console.log(`password hash format: bcrypt $2b$ (value hidden)`)
}

async function findAuthByEmail(supabase: SupabaseClient, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) fail(`Could not list Auth users: ${redact(error.message)}`)
    const match = data.users.find((row) => row.email?.toLowerCase() === email.toLowerCase())
    if (match) return match
    if (data.users.length < 200) return null
  }
  fail('Auth user list was larger than expected. Stopped before creating anyone.')
}

async function getAuthUser(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.auth.admin.getUserById(id)
  if (error) {
    if (error.status === 404 || /not found/i.test(error.message)) return null
    fail(`Could not read Auth user: ${redact(error.message)}`)
  }
  return data.user
}

async function assertAuthClear(supabase: SupabaseClient, user: AppUser) {
  const byId = await getAuthUser(supabase, user.id)
  if (byId) {
    fail(`Auth already has this UUID (${user.id}). No second Auth user was created.`)
  }
  const byEmail = await findAuthByEmail(supabase, user.email)
  if (byEmail) {
    fail(`Auth already has this email on id ${byEmail.id}. No second Auth user was created.`)
  }
}

async function readPassword(user: AppUser): Promise<string> {
  const fromEnv = process.env.AUTH_TEST_PASSWORD
  if (fromEnv) {
    trackSecret(fromEnv)
    console.log('Using AUTH_TEST_PASSWORD from this process. It will not be printed.')
    return fromEnv
  }
  try {
    const password = await askHidden('Existing password (hidden): ')
    trackSecret(password)
    return password
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Password prompt failed.')
    console.error(`Auth user ${user.id} was created. Legacy login was not changed.`)
    console.error(`Roll back with: npm run auth:test-import -- --rollback ${user.id}`)
    process.exit(1)
  }
}

async function passwordUnchanged(supabase: SupabaseClient, user: AppUser): Promise<boolean> {
  const { data, error } = await supabase.from('users').select('password').eq('id', user.id).single()
  if (error || !data) return false
  return data.password === user.password
}

async function runImport(selector: { email?: string; id?: string }) {
  const supabase = adminClient()
  anonClient()
  const user = await loadAppUser(supabase, selector)
  const baseline = await snapshot(supabase, user.id)
  printSummary(user, baseline)
  assertCandidate(user)
  await assertAuthClear(supabase, user)

  console.log('Preflight passed. public.users, tool rows, and storage will not be modified.')
  await confirmExact('MIGRATE')

  const created = await supabase.auth.admin.createUser({
    id: user.id,
    email: user.email,
    password_hash: user.password,
    email_confirm: true,
  })
  const importOk = !created.error && created.data.user?.id === user.id
  report('Supabase Auth import', importOk)
  if (created.error || !created.data.user) {
    report('Same UUID', false)
    report('Email confirmed', false)
    report('Auth identity created', false)
    fail(`Auth import failed: ${redact(created.error?.message || 'no user returned')}`)
  }

  const authUser = await getAuthUser(supabase, user.id)
  report('Same UUID', authUser?.id === user.id)
  report(
    'Email confirmed',
    Boolean(authUser?.email_confirmed_at) && authUser?.email?.toLowerCase() === user.email.toLowerCase()
  )
  report('Auth identity created', Boolean(authUser?.identities?.some((identity) => identity.provider === 'email')))

  const password = await readPassword(user)
  let signInOk = false
  if (!password) {
    report('Existing password accepted', false)
    report('Supabase session created', false)
    report('Session user id matches existing id', false)
    console.error(`No password was entered. Roll back with: npm run auth:test-import -- --rollback ${user.id}`)
  } else {
    const anon = anonClient()
    const signedIn = await anon.auth.signInWithPassword({ email: user.email, password })
    const sessionUserId = signedIn.data.user?.id
    const hasSession = Boolean(signedIn.data.session)
    signInOk = !signedIn.error && hasSession && sessionUserId === user.id
    report('Existing password accepted', !signedIn.error && sessionUserId === user.id)
    report('Supabase session created', !signedIn.error && hasSession)
    report('Session user id matches existing id', sessionUserId === user.id)
    if (signedIn.error) console.error(`Sign-in error: ${redact(signedIn.error.message)}`)
    if (hasSession) await anon.auth.signOut()
  }

  const after = await snapshot(supabase, user.id)
  const sameUser = await passwordUnchanged(supabase, user)
  const { data: row, error: rowError } = await supabase
    .from('users')
    .select('id, email, active, user_status')
    .eq('id', user.id)
    .single()
  report(
    'Existing public.users record',
    !rowError &&
      sameUser &&
      row?.id === user.id &&
      row.email === user.email &&
      row.active === user.active &&
      row.user_status === user.user_status
  )
  const toolsSame = after.tables.users_tools === baseline.tables.users_tools
  const dataSame = OWNED_TABLES.every((table) => after.tables[table] === baseline.tables[table])
  const storageSame = after.storageObjects === baseline.storageObjects
  const storageCheck: Check = baseline.storageObjects === 0 && storageSame ? 'na' : storageSame
  report('Existing tool ownership unchanged', toolsSame)
  report('Existing user-owned data unchanged', dataSame)
  report('Storage ownership unchanged', storageCheck)

  console.log('Legacy authentication files modified:')
  console.log('NO')
  console.log('Existing public.users password modified:')
  console.log(sameUser ? 'NO' : 'YES')

  const authOk =
    authUser?.id === user.id &&
    Boolean(authUser?.email_confirmed_at) &&
    authUser?.email?.toLowerCase() === user.email.toLowerCase() &&
    Boolean(authUser?.identities?.some((identity) => identity.provider === 'email'))
  const profileOk =
    !rowError &&
    sameUser &&
    row?.id === user.id &&
    row.email === user.email &&
    row.active === user.active &&
    row.user_status === user.user_status
  if (!authOk || !signInOk || !profileOk || !dataSame || !storageSame) process.exitCode = 1
}

async function runRollback(userId: string) {
  if (!UUID_V4.test(userId)) fail('Rollback id is not a UUID v4. No changes were made.')
  const supabase = adminClient()
  const user = await loadAppUser(supabase, { id: userId })
  assertCandidate(user)
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
  const samePassword = stillApp.password === user.password
  report('Auth user removed', stillAuth === null)
  report('public.users still exists', stillApp.id === user.id && samePassword)
  const dataSame =
    OWNED_TABLES.every((table) => after.tables[table] === baseline.tables[table]) &&
    after.storageObjects === baseline.storageObjects
  report('Existing application data unchanged', dataSame)
  console.log('Existing public.users password modified:')
  console.log(samePassword ? 'NO' : 'YES')
  if (stillAuth || !samePassword || !dataSame) process.exitCode = 1
}

async function main() {
  loadEnvFile(resolve(root, '.env.local'))
  const args = parseArgs(process.argv.slice(2))
  if (args.rollback) await runRollback(args.rollback)
  else await runImport({ email: args.email, id: args.id })
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unexpected failure'
  fail(redact(message))
})
