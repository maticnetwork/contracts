/* global web3 */

export async function mineOneBlock() {
  await web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_mine',
    id: new Date().getTime()
  })
}

export async function mineToBlockHeight(targetBlockHeight) {
  while (web3.eth.blockNumber < targetBlockHeight) {
    await mineOneBlock()
  }
}
