const status = require('../build/contracts/status.json')
const fs = require('fs')

const res = { root: {} }
for (let i = 0; i < Object.keys(status).length; i++) {
  if (status[i].type === 'deploy') {
    res.root[status[i].contract] = status[i].address
  }
}
fs.writeFileSync('./contractAddresses.json', JSON.stringify(res, null, 2)) // Indent 2 spaces
