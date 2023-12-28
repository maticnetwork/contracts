import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../../helpers/deployer.js'
import logDecoder from '../../../helpers/log-decoder.js'
import StatefulUtils from '../../../helpers/StatefulUtils.js'

import crypto from 'crypto'
import * as utils from '../../../helpers/utils.js'

chai.use(chaiAsPromised).should()
let contracts, childContracts, statefulUtils, tokenId, alice

describe('ERC721PredicateBurnOnly @skip-on-coverage', async function (accounts) {
  before(async function () {
    accounts = await ethers.getSigners()
    accounts = accounts.map((account) => {
      return account.address
    })
    alice = accounts[0]

    contracts = await deployer.freshDeploy(accounts[0])
    contracts.ERC721PredicateBurnOnly = await deployer.deployErc721Predicate(true)
    childContracts = await deployer.initializeChildChain()
    statefulUtils = new StatefulUtils()
  })

  describe('startExitWithBurntTokens', async function () {
    beforeEach(async function () {
      contracts.ERC721PredicateBurnOnly = await deployer.deployErc721Predicate()
      const { rootERC721, childErc721 } = await deployer.deployChildErc721()
      childContracts.rootERC721 = rootERC721
      childContracts.childErc721 = childErc721
      tokenId = '0x' + crypto.randomBytes(32).toString('hex')
    })

    it('Valid exit with burnt tokens', async function () {
      await utils.deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC721,
        alice,
        tokenId
      )
      const receipt = await (await childContracts.childErc721.withdraw(tokenId)).wait()
      let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(
        contracts.rootChain,
        receipt,
        accounts
      )
      const startExitTx = await (
        await utils.startExitWithBurntTokens(contracts.ERC721PredicateBurnOnly, {
          headerNumber,
          blockProof,
          blockNumber: block.number,
          blockTimestamp: block.timestamp,
          reference,
          logIndex: 1
        })
      ).wait()

      const logs = logDecoder.decodeLogs(startExitTx.events, contracts.withdrawManager.interface)
      const log = logs[1]

      log.event.should.equal('ExitStarted')
      chai.assert.deepEqual(log.args.exitor, alice)
      chai.assert.deepEqual(log.args.token, childContracts.rootERC721.address)
      chai.assert.deepEqual(log.args.isRegularExit, true)

      // amount is tokenId for NFTs
      utils.assertBigNumberEquality(log.args.amount, tokenId)
    })
  })
})
