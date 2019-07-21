import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../helpers/deployer.js'
// import { ValidatorContract } from '../helpers/artifacts'
import { DummyERC20, ValidatorContract } from '../helpers/artifacts'

import {
  assertBigNumberEquality,
  assertBigNumbergt,
  buildSubmitHeaderBlockPaylod
} from '../helpers/utils.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'
import logDecoder from '../helpers/log-decoder.js'

chai.use(chaiAsPromised).should()

contract('DelegationManager', async function(accounts) {
  let stakeManager, delegationManager, wallets, stakeToken

  before(async function() {
    wallets = generateFirstWallets(mnemonics, 10)
  })

  beforeEach(async function() {
    const contracts = await deployer.freshDeploy()
    // setToken
    stakeManager = contracts.stakeManager
    delegationManager = contracts.delegationManager
    stakeToken = await DummyERC20.new('Stake Token', 'STAKE')
    await stakeManager.setToken(stakeToken.address)
    await delegationManager.setToken(stakeToken.address)
    await stakeManager.updateValidatorThreshold(3)
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
      web3.utils.toWei('805')
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
  it('stake', async function() {
    const amount = web3.utils.toWei('200')
    const delegator = wallets[1].getAddressString()
    // approve tranfer
    await stakeToken.approve(delegationManager.address, amount, {
      from: delegator
    })
    // stake now
    let result = await delegationManager.stake(amount, {
      from: delegator
    })
    const logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    logs[1].event.should.equal('Staked')
    logs[1].args.user.toLowerCase().should.equal(delegator)
    // logs[2].args.amount.should.be.bignumber.equal(amount)
    // console.log(logs)
  })

  it('stake and bond/unbond', async function() {
    const amount = web3.utils.toWei('200')
    const validatorContracts = [true, true, false]
    for (let i = 0; i < 3; i++) {
      const user = wallets[i].getAddressString()
      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })
      // stake now
      await stakeManager.stake(amount, user, validatorContracts[i], {
        from: user
      })
    }

    for (let i = 3; i < 6; i++) {
      const delegator = wallets[i].getAddressString()
      // approve tranfer
      await stakeToken.approve(delegationManager.address, amount, {
        from: delegator
      })
      // stake now
      await delegationManager.stake(amount, {
        from: delegator
      })
    }
    let validatorContract
    let result = await delegationManager.bond(
      1 /** delegatorId */,
      1 /** validatorId */,
      {
        from: wallets[3].getAddressString()
      }
    )
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // console.log(logs)
    // validatorContract = ValidatorContract.at()
    // bondedTo require
    result = await delegationManager.bond(
      2 /** delegatorId */,
      1 /** validatorId */,
      {
        from: wallets[4].getAddressString()
      }
    )
    logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    console.log(logs)
    // validatorContract = ValidatorContract.at()
    //
    result = await delegationManager.bond(
      3 /** delegatorId */,
      2 /** validatorId */,
      {
        from: wallets[5].getAddressString()
      }
    )
    logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // console.log(logs)

    // validator 1 bonded amount delegatedAmount
  })

  it('reStake', async function() {})
  it('unstake and unstakeClaim', async function() {})
  it('getRewards', async function() {})
})
