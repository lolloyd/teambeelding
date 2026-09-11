const Configstore = require('C:/Users/LloydMiguel/AppData/Roaming/npm/node_modules/firebase-tools/node_modules/configstore/index.js')
const https = require('https')

const store = new Configstore('firebase-tools')
const tokens = store.get('tokens')
const access = tokens?.access_token

const body = JSON.stringify({
  resourceNames: ['projects/teambeelding-56d56'],
  filter: [
    'resource.type="cloud_run_revision"',
    'resource.labels.service_name="createroom"',
    'severity>=ERROR'
  ].join(' '),
  orderBy: 'timestamp desc',
  pageSize: 20
})

const opts = {
  hostname: 'logging.googleapis.com',
  path: '/v2/entries:list',
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + access,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}

const req = https.request(opts, res => {
  let d = ''
  res.on('data', c => d += c)
  res.on('end', () => {
    const parsed = JSON.parse(d)
    const entries = parsed.entries || []
    if (!entries.length) {
      console.log('No error entries found — trying without severity filter')
      // Try broader query
      const body2 = JSON.stringify({
        resourceNames: ['projects/teambeelding-56d56'],
        filter: 'resource.type="cloud_run_revision" resource.labels.service_name="createroom"',
        orderBy: 'timestamp desc',
        pageSize: 10
      })
      const opts2 = { ...opts, headers: { ...opts.headers, 'Content-Length': Buffer.byteLength(body2) } }
      const req2 = https.request(opts2, res2 => {
        let d2 = ''
        res2.on('data', c => d2 += c)
        res2.on('end', () => {
          const p2 = JSON.parse(d2)
          const e2 = p2.entries || []
          e2.forEach(e => {
            const msg = e.jsonPayload?.message || e.textPayload || JSON.stringify(e.jsonPayload).substring(0, 200)
            console.log(e.timestamp, '|', e.severity, '|', msg?.substring(0, 400))
            console.log('---')
          })
          if (!e2.length) console.log('Still no entries found')
        })
      })
      req2.write(body2)
      req2.end()
      return
    }
    entries.forEach(e => {
      const msg = e.jsonPayload?.message || e.textPayload || JSON.stringify(e.jsonPayload).substring(0, 200)
      console.log(e.timestamp, '|', e.severity, '|', msg?.substring(0, 400))
      console.log('---')
    })
  })
})
req.write(body)
req.end()
