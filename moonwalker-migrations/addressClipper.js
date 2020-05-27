const status = require('../build/status.json')
const fs = require('fs')

const res = { root: { tokens: {} } }
for (let i = 0; i < Object.keys(status).length; i++) {
  if (status[i].type !== 'deploy') continue
  if (status[i].contract === 'TestToken') {
    if (status[i].args[0] === process.env.MATIC_NAME) {
      res.root['tokens']['MaticToken'] = status[i].address
    } else {
      res.root['tokens']['TestToken'] = status[i].address
    }
  } else if (status[i].contract === 'MaticWETH') {
    res.root['tokens']['MaticWeth'] = status[i].address
  } else if (status[i].contract === 'RootERC721') {
    res.root['tokens'][status[i].contract] = status[i].address
  } else {
    res.root[status[i].contract] = status[i].address
  }
}

fs.writeFileSync('./contractAddresses.json', JSON.stringify(res, null, 2)) // Indent 2 spaces
