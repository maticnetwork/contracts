import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'
import BigNumber from 'bignumber.js'

import deployer from './helpers/deployer.js'
import * as _contracts from './helpers/contracts.js'
import logDecoder from './helpers/log-decoder.js'

chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
  .should()

contract('WithdrawManager', async function(accounts) {
  let rootChain, depositManager, maticWeth

  beforeEach(async function() {
    const contracts = await deployer.freshDeploy()
  })

  it('withdrawBurntTokens');
  it('withdrawTokens');
  it('withdrawDepositTokens');
})