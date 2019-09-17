import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import utils from 'ethereumjs-util'

import { DummyERC20, ValidatorContract } from '../helpers/artifacts'
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

contract('StakeManager<->DelegationManager', async function(accounts) {
  let stakeManager, delegationManager, wallets, stakeToken

  before(async function() {
    wallets = generateFirstWallets(mnemonics, 10)
  })

  beforeEach(async function() {
    const contracts = await deployer.freshDeploy({
      options: { stakeManager: true }
    })
    const amount = web3.utils.toWei('200')
    const validatorContracts = [true, true, false]

    // setToken
    stakeManager = contracts.stakeManager
    delegationManager = contracts.delegationManager
    stakeToken = await DummyERC20.new('Stake Token', 'STAKE')
    await stakeManager.setToken(stakeToken.address)
    await delegationManager.setToken(stakeToken.address)
    await stakeManager.updateValidatorThreshold(3)

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
    // validator/delegator staking
    for (let i = 0; i < 3; i++) {
      const user = wallets[i].getAddressString()
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })
      await stakeManager.stake(amount, user, validatorContracts[i], {
        from: user
      })
    }
    for (let i = 3; i < 6; i++) {
      const delegator = wallets[i].getAddressString()
      await stakeToken.approve(delegationManager.address, amount, {
        from: delegator
      })
      await delegationManager.stake(amount, {
        from: delegator
      })
    }
  })

  it('unBondLazy', async function() {
    await delegationManager.bond(1 /** delegatorId */, 1 /** validatorId */, {
      from: wallets[3].getAddressString()
    })
    await delegationManager.bond(2 /** delegatorId */, 1 /** validatorId */, {
      from: wallets[4].getAddressString()
    })
    await delegationManager.bond(3 /** delegatorId */, 1 /** validatorId */, {
      from: wallets[5].getAddressString()
    })
    let result = await stakeManager.unstake(1, {
      from: wallets[0].getAddressString()
    })
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    let validatorExitEpoch = logs[0].args.deactivationEpoch
    let delegator = await delegationManager.delegators('1')
    assertBigNumberEquality(validatorExitEpoch, delegator.delegationStopEpoch)

    delegator = await delegationManager.delegators('2')
    assertBigNumberEquality(validatorExitEpoch, delegator.delegationStopEpoch)

    delegator = await delegationManager.delegators('3')
    assertBigNumberEquality(validatorExitEpoch, delegator.delegationStopEpoch)
  })

  it('revertLazyUnBond', async function() {
    await delegationManager.bond(1 /** delegatorId */, 1 /** validatorId */, {
      from: wallets[3].getAddressString()
    })
    await delegationManager.bond(2 /** delegatorId */, 1 /** validatorId */, {
      from: wallets[4].getAddressString()
    })
    await delegationManager.bond(3 /** delegatorId */, 1 /** validatorId */, {
      from: wallets[5].getAddressString()
    })
    let result = await stakeManager.jail(1, 0, {
      from: wallets[0].getAddressString()
    })
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    let validatorExitEpoch = logs[0].args.exitEpoch
    let delegator = await delegationManager.delegators('1')
    assertBigNumberEquality(validatorExitEpoch, delegator.delegationStopEpoch)

    await stakeManager.unJail(1, {
      from: wallets[0].getAddressString()
    })
    delegator = await delegationManager.delegators('1')
    assertBigNumberEquality('0', delegator.delegationStopEpoch)
  })

  it('getRewards', async function() {
    await delegationManager.bond(1 /** delegatorId */, 1 /** validatorId */, {
      from: wallets[3].getAddressString()
    })
    await delegationManager.bond(2 /** delegatorId */, 1 /** validatorId */, {
      from: wallets[4].getAddressString()
    })
    await delegationManager.bond(3 /** delegatorId */, 1 /** validatorId */, {
      from: wallets[5].getAddressString()
    })
    let voteData = 'data'

    let w = [wallets[0], wallets[1], wallets[2]]
    const sigs = utils.bufferToHex(
      encodeSigs(getSigs(w, utils.keccak256(voteData)))
    )
    let validator = await stakeManager.validators(1)
    let validatorContracts = await ValidatorContract.at(
      validator.contractAddress
    )
    // get rewards
    let ValidatorReward = await validatorContracts.validatorRewards()
    assertBigNumberEquality('0', ValidatorReward)
    await stakeManager.changeRootChain(wallets[0].getAddressString())
    // 2/3 majority vote
    await stakeManager.checkSignatures(
      utils.bufferToHex(utils.keccak256(voteData)),
      sigs,
      wallets[0].getAddressString()
    )
    await stakeManager.finalizeCommit()
    assertBigNumbergt(
      await validatorContracts.validatorRewards(),
      ValidatorReward
    )
    for (let i = 3; i < 6; i++) {
      let balance = await stakeToken.balanceOf(wallets[i].getAddressString())
      await delegationManager.getRewards(i - 2, {
        from: wallets[i].getAddressString()
      })
      assertBigNumbergt(
        await stakeToken.balanceOf(wallets[i].getAddressString()),
        balance
      )
    }
  })
})
