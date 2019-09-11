import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../helpers/deployer.js'
// import { ValidatorContract } from '../helpers/artifacts'
import { DummyERC20, ValidatorContract } from '../helpers/artifacts'

import {
  assertBigNumberEquality,
  assertBigNumbergt,
  buildSubmitHeaderBlockPaylod,
  ZeroAddress
} from '../helpers/utils.js'
import { mineOneBlock, increaseBlockTime } from '../helpers/chain.js'
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
    await stakeManager.changeRootChain(wallets[0].getAddressString())
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
    assertBigNumberEquality(logs[1].args.amount, amount)
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
    logs[0].event.should.equal('Bonding')

    validatorContract = await ValidatorContract.at(
      logs[0].args.validatorContract
    )
    let delegatedAmount = await validatorContract.delegatedAmount()
    assertBigNumberEquality(delegatedAmount, amount)
    result = await delegationManager.bond(
      2 /** delegatorId */,
      1 /** validatorId */,
      {
        from: wallets[4].getAddressString()
      }
    )
    logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    logs[0].event.should.equal('Bonding')
    delegatedAmount = await validatorContract.delegatedAmount()
    assertBigNumberEquality(delegatedAmount, web3.utils.toWei('400'))

    await delegationManager.bond(3 /** delegatorId */, 2 /** validatorId */, {
      from: wallets[5].getAddressString()
    })
    let index
    let n = await validatorContract.totalDelegators()
    for (let i = 0; i < n; i++) {
      let delegatorId = await validatorContract.delegators(i)
      if (delegatorId.eq(web3.utils.toBN('1'))) {
        index = i
        i = n
      }
    }
    result = await delegationManager.unBond(1, index, {
      from: wallets[3].getAddressString()
    })

    logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    logs[0].event.should.equal('UnBonding')

    delegatedAmount = await validatorContract.delegatedAmount()
    assertBigNumberEquality(delegatedAmount, web3.utils.toWei('200'))

  })

  it('bond/unbond delegation hop limit test ', async function() {
    const amount = web3.utils.toWei('200')
    const validatorContracts = [true, true, true]
    await stakeManager.updateValidatorThreshold(4)
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
    logs[0].event.should.equal('Bonding')

    validatorContract = await ValidatorContract.at(
      logs[0].args.validatorContract
    )

    await delegationManager.bond(3 /** delegatorId */, 2 /** validatorId */, {
      from: wallets[5].getAddressString()
    })
    let index
    let n = await validatorContract.totalDelegators()

    for (let i = 0; i < n; i++) {
      let delegatorId = await validatorContract.delegators(i)
      if (delegatorId.eq(web3.utils.toBN('1'))) {
        index = i
        i = n
      }
    }
    result = await delegationManager.unBond(1, index, {
      from: wallets[3].getAddressString()
    })
    logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    logs[0].event.should.equal('UnBonding')
    try {
      await delegationManager.bond(
        1 /** delegatorId */,
        1 /** validatorId */,
        {
          from: wallets[3].getAddressString()
        }
      )
    } catch(error) {
      const invalidOpcode = error.message.search('revert') >= 0
      assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
    }
    await stakeManager.updateDynastyValue(2)

    let C = await stakeManager.WITHDRAWAL_DELAY()
    for(let i=0; i < C; i++) {
      await stakeManager.finalizeCommit()
    }

    result = await delegationManager.bond(
      1 /** delegatorId */,
      1 /** validatorId */,
      {
        from: wallets[3].getAddressString()
      }
    )

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
    await delegationManager.stake(amount, {
      from: delegator
    })
    let validatorContract
    let result = await delegationManager.bond(
      1 /** delegatorId */,
      1 /** validatorId */,
      {
        from: delegator
      }
    )
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)

    validatorContract = await ValidatorContract.at(
      logs[0].args.validatorContract
    )
    await stakeToken.approve(delegationManager.address, amount, {
      from: delegator
    })

    let data = await delegationManager.delegators("1")
    assertBigNumberEquality(data.amount, amount)

    result = await delegationManager.reStake(1, amount, true, {
      from: delegator
    })
    logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // TODO: once dummyToken is gone logs[0] =transfer event
    logs[0].event.should.equal('ReStaked')
    assertBigNumberEquality(logs[0].args.amount, amount)

    data = await delegationManager.delegators("1")
    assertBigNumberEquality(data.amount, web3.utils.toWei('400'))
    // unbond
    let index
    let n = await validatorContract.totalDelegators()
    for (let i = 0; i < n; i++) {
      let delegatorId = await validatorContract.delegators(i)
      if (delegatorId.eq(web3.utils.toBN('1'))) {
        index = i
        i = n
      }
    }
    await delegationManager.unBond(1, index, {
      from: delegator
    })

    await stakeToken.approve(delegationManager.address, amount, {
      from: delegator
    })
    // restake while unbonded
    result = await delegationManager.reStake(1, amount, false, {
      from: delegator
    })

    logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    logs[0].event.should.equal('ReStaked')
    assertBigNumberEquality(logs[0].args.amount, amount)

    data = await delegationManager.delegators("1")
    assertBigNumberEquality(data.amount, web3.utils.toWei('600'))
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
    await delegationManager.stake(amount, {
      from: delegator
    })
    let result = await delegationManager.bond(
      1 /** delegatorId */,
      1 /** validatorId */,
      {
        from: delegator
      }
    )
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    let validatorContract = await ValidatorContract.at(
      logs[0].args.validatorContract
    )
    let index
    let n = await validatorContract.totalDelegators()
    for (let i = 0; i < n; i++) {
      let delegatorId = await validatorContract.delegators(i)
      if (delegatorId.eq(web3.utils.toBN('1'))) {
        index = i
        i = n
      }
    }

    // unstake
    result = await delegationManager.unstake(1, index, { from: delegator })
    logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    logs[0].event.should.equal('UnBonding') // unstaking without unbonding
    // unstakeClaim
    let withdrawDelay = await stakeManager.WITHDRAWAL_DELAY()

    for(let i=0;i < withdrawDelay; i++){
      await stakeManager.finalizeCommit()
    }
    result = await delegationManager.unstakeClaim(1, { from: delegator })
    logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    logs[0].event.should.equal('Transfer')
    // should burn NFT

    logs[0].args.to.toLowerCase().should.equal(ZeroAddress)
    // logs[1].event.should.equal('Transfer') dummtoken no transfer event
    logs[1].event.should.equal('Unstaked')
    assertBigNumberEquality(logs[1].args.amount, amount)
  })
})
