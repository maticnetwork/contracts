import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import utils from 'ethereumjs-util'

import deployer from '../helpers/deployer.js'
import { ValidatorContract } from '../helpers/artifacts'

import { assertBigNumberEquality } from '../helpers/utils.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'

chai.use(chaiAsPromised).should()

contract('ValidatorContract', async function(accounts) {
  let validatorContract, wallets, registry

  before(async function() {
    wallets = generateFirstWallets(mnemonics, 4)
    const contracts = await deployer.freshDeploy()
    registry = contracts.registry
    await registry.updateContractMap(
      utils.keccak256('delegationManager'),
      wallets[2].getAddressString()
    )
  })

  beforeEach(async function() {
    validatorContract = await ValidatorContract.new(
      wallets[1].getAddressString(),
      registry.address
    )
  })

  it('write history for checkpoint rewards and get rewards for delegator/validator', async function() {
    const validatorStake = web3.utils.toWei('100')
    const delegatorStake = web3.utils.toWei('100')
    const checkpointReward = web3.utils.toWei('1')

    await validatorContract.bond(1, delegatorStake, '1', {
      from: wallets[2].getAddressString()
    })
    for (let checkpoint = 1; checkpoint < 10; checkpoint++) {
      await validatorContract.updateRewards(
        checkpointReward,
        checkpoint,
        validatorStake
      )
    }
    let validatorRewards = await validatorContract.validatorRewards()
    // getRewards(delegatorId, delegationAmount, startEpoch, endEpoch, currentEpoch)
    //  delegatorId,  delegationAmount,  startEpoch,  endEpoch,  currentEpoch
    let delegatorRewards = await validatorContract.getRewards(
      '1',
      delegatorStake,
      '1',
      '10',
      '10',
      { from: wallets[2].getAddressString() }
    )
    let totalReward = web3.utils
      .toBN(checkpointReward)
      .mul(web3.utils.toBN('9'))
    assertBigNumberEquality(validatorRewards.add(delegatorRewards), totalReward)
  })

  it('bond unBond properly', async function() {
    const delegatorStake = web3.utils.toWei('100')
    const delegators = 10
    for (let i = 0; i < delegators; i++) {
      await validatorContract.bond(i, delegatorStake, '1', {
        from: wallets[2].getAddressString()
      })
    }
    const delegator2 = web3.utils.toBN(2)
    const n = await validatorContract.totalDelegators()
    const totalDelegation = await validatorContract.delegatedAmount()
    assertBigNumberEquality(n, delegators)
    let delegatorIndex
    for (let i = 0; i < n; i++) {
      let delegatorId = await validatorContract.delegators(i)
      if (delegator2.eq(delegatorId)) {
        delegatorIndex = i
        i = n
      }
    }
    await validatorContract.unBond(
      delegator2,
      delegatorIndex,
      delegatorStake,
      '10',
      {
        from: wallets[2].getAddressString()
      }
    )
    assertBigNumberEquality(
      await validatorContract.delegatedAmount(),
      totalDelegation.sub(web3.utils.toBN(delegatorStake))
    )
    assertBigNumberEquality(
      await validatorContract.totalDelegators(),
      delegators - 1
    )
  })
})
