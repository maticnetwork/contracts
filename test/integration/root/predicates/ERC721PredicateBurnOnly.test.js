import ethUtils from 'ethereumjs-util'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../../helpers/deployer.js'
import logDecoder from '../../../helpers/log-decoder.js'
import { buildInFlight } from '../../../mockResponses/utils'
import StatefulUtils from '../../../helpers/StatefulUtils'

const predicateTestUtils = require('./predicateTestUtils')
const crypto = require('crypto')
const utils = require('../../../helpers/utils')
const web3Child = utils.web3Child

chai.use(chaiAsPromised).should()
let contracts, childContracts
let statefulUtils

contract('ERC721PredicateBurnOnly @skip-on-coverage', async function(accounts) {
  let tokenId
  const alice = accounts[0]
  const bob = accounts[1]

  before(async function() {
    contracts = await deployer.freshDeploy(accounts[0])
    contracts.ERC721Predicate = await deployer.deployErc721Predicate(true)
    childContracts = await deployer.initializeChildChain(accounts[0])
    statefulUtils = new StatefulUtils()
  })

  describe('startExitWithBurntTokens', async function() {
    beforeEach(async function() {
      contracts.ERC721Predicate = await deployer.deployErc721Predicate()
      const { rootERC721, childErc721 } = await deployer.deployChildErc721(accounts[0])
      childContracts.rootERC721 = rootERC721
      childContracts.childErc721 = childErc721
      tokenId = '0x' + crypto.randomBytes(32).toString('hex')
    })

    it('Valid exit with burnt tokens', async function() {
      await utils.deposit(
        contracts.depositManager,
        childContracts.childChain,
        childContracts.rootERC721,
        alice,
        tokenId
      )
      const { receipt } = await childContracts.childErc721.withdraw(tokenId)
      let { block, blockProof, headerNumber, reference } = await statefulUtils.submitCheckpoint(contracts.rootChain, receipt, accounts)
      const startExitTx = await utils.startExitWithBurntTokens(
        contracts.ERC721Predicate,
        { headerNumber, blockProof, blockNumber: block.number, blockTimestamp: block.timestamp, reference, logIndex: 1 }
      )
      const logs = logDecoder.decodeLogs(startExitTx.receipt.rawLogs)
      // console.log(startExitTx, logs)
      const log = logs[1]
      log.event.should.equal('ExitStarted')
      expect(log.args).to.include({
        exitor: alice,
        token: childContracts.rootERC721.address,
        isRegularExit: true
      })
      utils.assertBigNumberEquality(log.args.amount, tokenId)
    })
  })
})
