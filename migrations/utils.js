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

export function assertBigNumberEquality(num1, num2) {
  if (!ethUtils.BN.isBN(num1)) num1 = web3.utils.toBN(num1.toString())
  if (!ethUtils.BN.isBN(num2)) num2 = web3.utils.toBN(num2.toString())
  assert(
    num1.eq(num2),
    `expected ${num1.toString(10)} and ${num2.toString(10)} to be equal`
  )
}
