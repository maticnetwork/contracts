/* global assert */

// From OpenZeppelin/zeppelin-solidity
export default async function(promise, err) {
  try {
    await promise
  } catch (error) {
    const invalidOpcode = error.message.search('revert') >= 0
    assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
    return
  }
  assert.ok(false, err || 'Error containing "revert" must be returned')
}
