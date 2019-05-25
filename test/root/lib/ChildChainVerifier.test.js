import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import utils from 'ethereumjs-util'

import deployer from '../../helpers/deployer.js'
import { ChildChainVerifier, Registry } from '../../helpers/artifacts'
import { build } from '../../mockResponses/utils'
import incomingTransfer from '../../mockResponses/incomingTransfer'

const rlp = utils.rlp
chai
  .use(chaiAsPromised)
  .should()

contract('ChildChainVerifier', async function(accounts) {
  describe('processReferenceTx', async function() {
    let contracts, instance
    before(async function() {
      contracts = await deployer.freshDeploy()
      instance = await ChildChainVerifier.deployed()
    })

    it('Erc20 - LOG_TRANSFER_EVENT_SIG - Participant transferred tokens', async function() {
      const event = incomingTransfer
      const rootToken = '0x' + event.receipt.logs[1].topics[1].slice(26).toLowerCase()
      const childToken = event.receipt.to.toLowerCase()
      await mapToken(contracts.registry, rootToken, childToken, false /* isERC721 */)
      const input = await build(event)
      const res = await processReferenceTx(
        instance, input, 1 /* logIndex */,
        event.tx.from /* participant */,
        childToken,
        // This value should <= closing balance of the participant after the tx
        // In mockResponses/incomingTransfer, the participant is transferring all their tokens, hence sending a value that wouldn't fail the test
        0,
        contracts.registry.address
      )
      // console.log(res)
      expect(res.rootToken.toLowerCase()).to.equal(rootToken)
    })

    it('Erc20 - LOG_TRANSFER_EVENT_SIG - Participant received tokens', async function() {
      const event = incomingTransfer
      const beneficiary = '0x' + event.tx.input.slice(34, 74)
      const rootToken = '0x' + event.receipt.logs[1].topics[1].slice(26).toLowerCase()
      const childToken = event.receipt.to.toLowerCase()
      await mapToken(contracts.registry, rootToken, childToken, false /* isERC721 */)
      const input = await build(event)
      const res = await processReferenceTx(
        instance, input, 1 /* logIndex */,
        beneficiary /* participant */,
        childToken,
        // This value should <= closing balance of the participant after the tx
        // In mockResponses/incomingTransfer, the beneficiary is getting 0xa tokens
        '0xa',
        contracts.registry.address
      )
      // console.log(res)
      expect(res.rootToken.toLowerCase()).to.equal(rootToken)
    })
  })
})

async function mapToken(registry, rootToken, childToken, isERC721) {
  const isTokenMapped = await registry.rootToChildToken(rootToken)
  if (!parseInt(isTokenMapped.slice(2), 16)) {
    await registry.mapToken(rootToken, childToken, isERC721)
  }
}

async function processReferenceTx(instance, input, logIndex, participant, childToken, exitAmountOrTokenId, registry) {
  const res = await instance.processReferenceTx(
    utils.bufferToHex(input.receiptsRoot),
    utils.bufferToHex(input.receipt),
    utils.bufferToHex(rlp.encode(input.receiptParentNodes)),
    // utils.bufferToHex(input.tx),
    // utils.bufferToHex(rlp.encode(input.txParentNodes)),
    // utils.bufferToHex(input.transactionsRoot),
    utils.bufferToHex(rlp.encode(input.path)),
    logIndex,
    participant,
    childToken,
    exitAmountOrTokenId,
    registry
  )
  return res
}
