/**
 * Sets allUsers as roles/run.invoker on all Firebase v2 Cloud Run services
 * using the Firebase CLI's stored OAuth2 credentials (lloyd.miguel@gmail.com).
 *
 * Usage: node scripts/setCloudRunIam.cjs
 */

const https = require('https')
const path  = require('path')

// Load Firebase CLI credentials
let tokens, CLIENT_ID, CLIENT_SECRET
try {
  const ftPath = path.join(process.env.APPDATA, 'npm', 'node_modules', 'firebase-tools')
  const Configstore = require(require.resolve('configstore', { paths: [ftPath] }))
  const store = new Configstore('firebase-tools')
  tokens = store.all.tokens
  if (!tokens?.refresh_token) throw new Error('No refresh token found')
  const api = require(path.join(ftPath, 'lib', 'api'))
  CLIENT_ID     = api.clientId
  CLIENT_SECRET = api.clientSecret
} catch (e) {
  console.error('Could not load Firebase CLI credentials:', e.message)
  process.exit(1)
}

function post(hostname, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
    const req = https.request({
      hostname, path: urlPath, method: 'POST',
      headers: { 'Content-Length': Buffer.byteLength(bodyStr), ...headers },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}

async function getAccessToken() {
  const body = `client_id=${encodeURIComponent(CLIENT_ID)}&client_secret=${encodeURIComponent(CLIENT_SECRET)}&refresh_token=${encodeURIComponent(tokens.refresh_token)}&grant_type=refresh_token`
  const r = await post('oauth2.googleapis.com', '/token', body, { 'Content-Type': 'application/x-www-form-urlencoded' })
  const json = JSON.parse(r.body)
  if (!json.access_token) { console.error('Token refresh failed:', r.body); process.exit(1) }
  return json.access_token
}

const PROJECT   = 'teambeelding-56d56'
const REGION    = 'us-central1'
const FUNCTIONS = [
  'createroom','joinroom','startgame','startquestion',
  'pausequestion','resumequestion','closequestion','submitanswer',
  'revealanswer','skipquestion','showleaderboard','preparenextquestion',
  'adjustscore','removeplayer','endgame','importgamepackage',
  'publishgame','unpublishgame','deletegame','updateappconfig','cleanupexpiredrooms',
]

;(async () => {
  console.log('Getting access token...')
  const token = await getAccessToken()
  console.log('Token obtained.\n')
  let ok = 0, fail = 0
  for (const fn of FUNCTIONS) {
    process.stdout.write(`  ${fn}... `)
    const body = JSON.stringify({ policy: { bindings: [{ role: 'roles/run.invoker', members: ['allUsers'] }] } })
    const r = await post(
      'run.googleapis.com',
      `/v1/projects/${PROJECT}/locations/${REGION}/services/${fn}:setIamPolicy`,
      body,
      { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    )
    if (r.status === 200) { console.log('OK'); ok++ }
    else { console.log(`FAILED (${r.status}): ${JSON.parse(r.body)?.error?.message || r.body}`); fail++ }
  }
  console.log(`\nDone: ${ok} OK, ${fail} failed.`)
  if (fail > 0) console.log(`Check service names at: https://console.cloud.google.com/run?project=${PROJECT}`)
})().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
