/* global assert, web3 */

// From OpenZeppelin/zeppelin-solidity
export default async function(promise, err) {
  try {
    const tx = await promise
    const receipt = await web3.eth.getTransactionReceipt(tx.tx)
    if (receipt.gasUsed >= 6700000) {
      return
    }
  } catch (error) {
    const invalidOpcode = error.message.search('revert') >= 0
    assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
    return
  }
  assert.ok(false, err || 'Error containing "revert" must be returned')
}
