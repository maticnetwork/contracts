import chai from 'chai'
import utils from 'ethereumjs-util'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../helpers/deployer.js'
import { DummyERC20, DelegationManager } from '../helpers/artifacts'

import {
  assertBigNumberEquality,
  checkPoint,
  ZeroAddress
} from '../helpers/utils.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'
import logDecoder from '../helpers/log-decoder'

chai.use(chaiAsPromised).should()

contract('DelegationManager', async function(accounts) {
  let stakeManager, delegationManager, wallets, stakeToken
  // let logDecoder = new LogDecoder([DelegationManager._json.abi])

  before(async function() {
    wallets = generateFirstWallets(mnemonics, 10)
  })

  beforeEach(async function() {
    const contracts = await deployer.freshDeploy({ stakeManager: true })
    // setToken
    stakeManager = contracts.stakeManager
    delegationManager = contracts.delegationManager
    stakeToken = await DummyERC20.at(await delegationManager.token())
    await stakeManager.updateValidatorThreshold(3)
    await stakeManager.updateCheckPointBlockInterval(1)
    await stakeManager.changeRootChain(wallets[0].getAddressString())
    // mint tokens to other accounts
    for (let i = 0; i < 6; i++) {
      await stakeToken.mint(
        wallets[i].getAddressString(),
        web3.utils.toWei('12000')
      )
    }
  })

  it('stake', async function() {
    const amount = web3.utils.toWei('200')
    const delegator = wallets[1].getAddressString()
    // approve tranfer
    await stakeToken.approve(delegationManager.address, amount, {
      from: delegator
    })
    // stake now
    let result = await delegationManager.stake(amount, 0, {
      from: delegator
    })
    // const logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    console.log(result.receipt.rawLogs)
    // logs[1].event.should.equal('Staked')
    // logs[1].args.signer.toLowerCase().should.equal(delegator)
    // assertBigNumberEquality(logs[1].args.amount, amount)
  })

  it('stake and bond/unbond', async function() {
    const amount = web3.utils.toWei('200')
    for (let i = 0; i < 3; i++) {
      const user = wallets[i].getAddressString()
      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })
      // stake now
      await stakeManager.stake(amount, user, true, {
        from: user
      })
    }

    let result
    for (let i = 3; i < 6; i++) {
      const delegator = wallets[i].getAddressString()
      // approve tranfer
      await stakeToken.approve(delegationManager.address, amount, {
        from: delegator
      })
      // stake now
      result = await delegationManager.stake(amount, 1, {
        from: delegator
      })
      // let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
      // logs[0].event.should.equal('Bonding')
    }

    result = await delegationManager.unBond(4, {
      from: wallets[3].getAddressString()
    })

    // logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // logs[0].event.should.equal('UnBonding')
  })

  it('reStake', async function() {
    const amount = web3.utils.toWei('200')
    const user = wallets[1].getAddressString()
    // approve tranfer
    await stakeToken.approve(stakeManager.address, amount, {
      from: user
    })
    // stake now
    await stakeManager.stake(amount, user, true, {
      from: user
    })
    const delegator = wallets[2].getAddressString()
    // approve tranfer
    await stakeToken.approve(delegationManager.address, amount, {
      from: delegator
    })
    // stake now
    await delegationManager.stake(amount, 1, {
      from: delegator
    })

    await stakeToken.approve(delegationManager.address, amount, {
      from: delegator
    })

    let data = await delegationManager.delegators('2')
    assertBigNumberEquality(data.amount, amount)
    // reStake(uint256 delegatorId, uint256 amount, bool stakeRewards)
    let result = await delegationManager.reStake(2, amount, false, {
      from: delegator
    })

    // let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // TODO: once dummyToken is gone logs[0] =transfer event
    // logs[0].event.should.equal('ReStaked')
    // assertBigNumberEquality(logs[0].args.amount, amount)

    data = await delegationManager.delegators('2')
    assertBigNumberEquality(data.amount, web3.utils.toWei('400'))

    await delegationManager.unBond(2, {
      from: delegator
    })

    await stakeToken.approve(delegationManager.address, amount, {
      from: delegator
    })
    // restake while unbonded
    result = await delegationManager.reStake(2, amount, false, {
      from: delegator
    })
    console.log(result.receipt.rawLogs)
    // logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // logs[0].event.should.equal('ReStaked')
    // assertBigNumberEquality(logs[0].args.amount, amount)

    data = await delegationManager.delegators('2')
    assertBigNumberEquality(data.amount, web3.utils.toWei('600'))
  })

  it('claimRewards and withdrawRewards', async function() {
  })

  it('unstake and unstakeClaim', async function() {
    const amount = web3.utils.toWei('200')
    const user = wallets[1].getAddressString()
    await stakeManager.updateDynastyValue(2)
    // approve tranfer
    await stakeToken.approve(stakeManager.address, amount, {
      from: user
    })
    // stake now
    await stakeManager.stake(amount, user, true, {
      from: user
    })
    const delegator = wallets[2].getAddressString()
    // approve tranfer
    await stakeToken.approve(delegationManager.address, amount, {
      from: delegator
    })
    // stake now
    await delegationManager.stake(amount, 1, {
      from: delegator
    })
    let result = await delegationManager.bond(
      2 /** delegatorId */,
      1 /** validatorId */,
      {
        from: delegator
      }
    )
    // unstake
    result = await delegationManager.unstake(2, { from: delegator })
    // let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // logs[0].event.should.equal('UnBonding') // unstaking without unbonding
    // unstakeClaim
    // let withdrawDelay = await stakeManager.WITHDRAWAL_DELAY()
    // let w = [wallets[1]]
    // for (let i = 0; i < withdrawDelay; i++) {
    //   await checkPoint(w, wallets[0], stakeManager)
    // }
    // result = await delegationManager.unstakeClaim(1, { from: delegator })
    // console.log(result.receipt.rawLogs)
    // logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // logs[0].event.should.equal('Transfer')
    // should burn NFT

    // logs[0].args.to.toLowerCase().should.equal(ZeroAddress)
    // logs[1].event.should.equal('Transfer') dummtoken no transfer event
    // logs[1].event.should.equal('Unstaked')
    // assertBigNumberEquality(logs[1].args.amount, amount)
  })
})
