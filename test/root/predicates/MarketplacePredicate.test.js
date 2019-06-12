import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../helpers/deployer.js'
import logDecoder from '../../helpers/log-decoder.js'
import { getSig } from '../../helpers/marketplaceUtils'
import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'
const utils = require('../../helpers/utils')
const executeOrder = require('../../mockResponses/marketplace-executeOrder-E20-E20')

chai
  .use(chaiAsPromised)
  .should()

contract("MarketplacePredicate", async function(accounts) {
  let childContracts, marketplace, predicate
  const amount1 = web3.utils.toBN('10')
  const amount2 = web3.utils.toBN('5')
  const tokenId = web3.utils.toBN('789')
  const stakes = {
    1: web3.utils.toWei('101'),
    2: web3.utils.toWei('100'),
    3: web3.utils.toWei('100'),
    4: web3.utils.toWei('100')
  }
  const wallets = generateFirstWallets(mnemonics, Object.keys(stakes).length)
  const privateKey1 = wallets[0].getPrivateKeyString()
  const address1 = wallets[0].getAddressString()
  const privateKey2 = wallets[1].getPrivateKeyString()
  const address2 = wallets[1].getAddressString()

  before(async function() {
    // marketplace = await deployer.deployMarketplace()
    predicate = await deployer.deployMarketplacePredicate()
  })

  // beforeEach(async function() {
  //   childContracts = await deployer.initializeChildChain(accounts[0])
  // })

  it('startExit', async function() {
    const startExit = await predicate.startExit(executeOrder.tx.input)
    console.log(startExit)
  })

})


