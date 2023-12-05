const fs = require('fs')
const ethUtils = require('ethereumjs-util')

export function getContractAddresses() {
  return JSON.parse(fs.readFileSync(`${process.cwd()}/contractAddresses.json`).toString())
}

export function writeContractAddresses(contractAddresses) {
  fs.writeFileSync(
    `${process.cwd()}/contractAddresses.json`,
    JSON.stringify(contractAddresses, null, 2) // Indent 2 spaces
  )
}

export async function updateContractMap(governance, registry, name, value) {
  return governance.update(
    registry.address,
    registry.contract.methods.updateContractMap(ethUtils.keccak256(name), value).encodeABI()
  )
}
