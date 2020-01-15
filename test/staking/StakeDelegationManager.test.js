import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import utils from 'ethereumjs-util'

import { DummyERC20, ValidatorShare } from '../helpers/artifacts'
import logDecoder from '../helpers/log-decoder.js'

import deployer from '../helpers/deployer.js'
import {
  assertBigNumberEquality,
  assertBigNumbergt,
  encodeSigs,
  getSigs
} from '../helpers/utils.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'

chai.use(chaiAsPromised).should()

contract('StakeManager<->Delegation', async function (accounts) {
  let stakeManager, delegationManager, wallets, stakeToken

  before(async function () {
    wallets = generateFirstWallets(mnemonics, 10)
  })

  beforeEach(async function () {
    const contracts = await deployer.freshDeploy({ stakeManager: true })
    const amount = web3.utils.toWei('200')
    const validatorContracts = [true, true, false]

    // setToken
    stakeManager = contracts.stakeManager
    delegationManager = contracts.delegationManager
    stakeToken = await DummyERC20.new('Stake Token', 'STAKE')
    await stakeManager.updateCheckPointBlockInterval(1)
    await stakeManager.setToken(stakeToken.address)
    await stakeManager.changeRootChain(wallets[0].getAddressString())
    await delegationManager.setToken(stakeToken.address)
    await stakeManager.updateValidatorThreshold(3)
    await stakeManager.updateCheckPointBlockInterval(1)

    await stakeManager.updateDynastyValue(2)
    // transfer tokens to other accounts
    await stakeToken.mint(
      wallets[0].getAddressString(),
      web3.utils.toWei('1200')
    )
    await stakeToken.mint(
      wallets[1].getAddressString(),
      web3.utils.toWei('800')
    )
    await stakeToken.mint(
      wallets[2].getAddressString(),
      web3.utils.toWei('1200')
    )
    await stakeToken.mint(
      wallets[3].getAddressString(),
      web3.utils.toWei('850')
    )
    await stakeToken.mint(
      wallets[4].getAddressString(),
      web3.utils.toWei('800')
    )
    await stakeToken.mint(
      wallets[5].getAddressString(),
      web3.utils.toWei('800')
    )
  })

  it('Submit checkpoint and test rewards with exchange rate', async function () {

  })

  it('UnStake validator and test for delegation shares', async function () {

  })

  it('ClaimRewards for delegator and validator', async function () {

  })

  it('Jail/UnJail validator and delegation contract state', async function () {

  })

  it('ClaimRewards for delegator and validator', async function () {

  })
})
