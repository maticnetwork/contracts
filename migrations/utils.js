const fs = require('fs')

export function getContractAddresses(type) {
  return JSON.parse(fs.readFileSync(`${process.cwd()}/addresses.${type}.json`).toString())
}

export function writeContractAddresses(contractAddresses, type) {
  fs.writeFileSync(
    `${process.cwd()}/addresses.${type}.json`,
    JSON.stringify(contractAddresses, null, 2) // Indent 2 spaces
  )
}
