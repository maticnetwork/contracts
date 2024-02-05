import deployer from '../../helpers/deployer.js'
import logDecoder from '../../helpers/log-decoder.js'
import { ValidatorShare, StakingInfo } from '../../helpers/artifacts.js'

import {
  checkPoint,
  updateSlashedAmounts,
  assertBigNumbergt,
  assertBigNumberEquality,
  assertInTransaction
} from '../../helpers/utils.js'
import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'
import { buyVoucher } from './ValidatorShareHelper.js'
import { BN } from 'ethereumjs-util'
import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'

chai.use(chaiAsPromised).should()
const assert = chai.assert

describe('Slashing:validator', async function () {
  let stakeToken
  let stakeManager
  let slashingManager
  let stakingInfo
  const wallets = generateFirstWallets(mnemonics, 10)
  const DYNASTY = 8

  describe('validator slashing', async function () {
    const stakeAmount = web3.utils.toWei('1000')

    async function doDeploy() {
      let contracts = await deployer.deployStakeManager(wallets)
      stakeToken = contracts.stakeToken
      stakeManager = contracts.stakeManager
      slashingManager = contracts.slashingManager
      stakingInfo = contracts.stakingInfo

      await contracts.governance.update(
        stakeManager.address,
        stakeManager.interface.encodeFunctionData('updateDynastyValue', [DYNASTY])
      )
      await contracts.governance.update(
        stakeManager.address,
        stakeManager.interface.encodeFunctionData('updateCheckPointBlockInterval', [1])
      )

      await stakeManager.changeRootChain(wallets[0].getAddressString())

      const amount = web3.utils.toWei('1002')
      const heimdallFee = web3.utils.toWei('2')

      for (let i = 0; i < 2; i++) {
        await stakeToken.mint(wallets[i].getAddressString(), amount)

        const stakeToken_i = stakeToken.connect(stakeToken.provider.getSigner(i))
        await stakeToken_i.approve(stakeManager.address, amount)

        const stakeManager_i = stakeManager.connect(stakeManager.provider.getSigner(i))
        await stakeManager_i.stakeFor(
          wallets[i].getAddressString(),
          stakeAmount,
          heimdallFee,
          false,
          wallets[i].getPublicKeyString()
        )
      }
      await stakeToken.mint(stakeManager.address, web3.utils.toWei('1000000')) // rewards amount
    }

    describe('when validator is not slashed to 0', function () {
      beforeEach(doDeploy)

      it('should slash validators', async function () {
        const amount = +web3.utils.toWei('100')
        const slashingInfoList = [
          [1, amount, '0x0'],
          [2, amount, '0x0']
        ]

        const result = await (
          await updateSlashedAmounts([wallets[0], wallets[1]], wallets[1], 1, slashingInfoList, slashingManager)
        ).wait()
        const logs = logDecoder.decodeLogs(result.events, stakingInfo.interface, stakeToken.interface)
        logs.should.have.lengthOf(3)
        logs[0].event.should.equal('Slashed')
        logs[1].event.should.equal('Transfer')
        logs[2].event.should.equal('Transfer')
        assertBigNumberEquality(logs[0].args.amount, web3.utils.toWei('200'))
        const validator1 = await stakeManager.validators(1)
        const validator2 = await stakeManager.validators(2)
        assertBigNumberEquality(validator1.amount, web3.utils.toWei('900'))
        assertBigNumberEquality(validator2.amount, web3.utils.toWei('900'))
      })

      it('should slash validator:jail and send checkpoint', async function () {
        const amount = +web3.utils.toWei('100')
        const validator1Wallet = wallets[0]
        const slashingInfoList = [[2, amount, '0x1']]

        const result = await (
          await updateSlashedAmounts([wallets[0], wallets[1]], wallets[1], 1, slashingInfoList, slashingManager)
        ).wait()

        const logs = logDecoder.decodeLogs(result.events, stakingInfo.interface, stakeToken.interface)
        logs.should.have.lengthOf(4)
        logs[0].event.should.equal('Jailed')
        logs[1].event.should.equal('Slashed')
        assertBigNumberEquality(logs[1].args.amount, web3.utils.toWei('100'))

        const validator1 = await stakeManager.validators(1)
        const val1RewardBefore = await stakeManager.validatorReward(1)
        const validator2 = await stakeManager.validators(2)

        assertBigNumberEquality(validator2.amount, web3.utils.toWei('900'))

        assert.equal(await stakeManager.isValidator(2), false)

        assertBigNumberEquality(await stakeManager.currentValidatorSetTotalStake(), validator1.amount)

        await checkPoint([validator1Wallet], validator1Wallet, stakeManager)

        const val1RewardAfter = await stakeManager.validatorReward(1)
        assertBigNumbergt(val1RewardAfter, val1RewardBefore)
        assertBigNumberEquality(val1RewardAfter, await stakeManager.CHECKPOINT_REWARD()) // reward starts from 1, not 0
      })

      it('should test jail/unjail', async function () {
        const amount = +web3.utils.toWei('100')
        const validator1Wallet = wallets[0]
        const validator2Wallet = wallets[1]
        const slashingInfoList = [[2, amount, '0x1']]

        await updateSlashedAmounts([wallets[0], wallets[1]], wallets[1], 1, slashingInfoList, slashingManager)

        await checkPoint([validator1Wallet], validator1Wallet, stakeManager)
        const stakeManager2 = stakeManager.connect(stakeManager.provider.getSigner(validator2Wallet.getAddressString()))
        await stakeManager2.unjail(2)
        assert.equal(await stakeManager.isValidator(2), true)
        await checkPoint([validator1Wallet, validator2Wallet], validator1Wallet, stakeManager)
        const validator2Reward = await stakeManager.validatorReward(2)
        let expectedRewards = await stakeManager.CHECKPOINT_REWARD()
        expectedRewards = expectedRewards
          .mul(web3.utils.toWei('900'))
          .div(web3.utils.toWei('1900'))
        expectedRewards = expectedRewards.mul(90).div(100) // reduce 10% commission
        assertBigNumbergt(validator2Reward, expectedRewards) // change due to updated rewards 5047
      })

      it('should test jail => unstake', async function () {
        const amount = +web3.utils.toWei('100')
        const validator2Wallet = wallets[1]
        const slashingInfoList = [[2, amount, '0x1']]

        await updateSlashedAmounts([wallets[0], wallets[1]], wallets[1], 1, slashingInfoList, slashingManager)

        const stakeManager2 = stakeManager.connect(stakeManager.provider.getSigner(validator2Wallet.getAddressString()))
        const result = await (await stakeManager2.unstake(2)).wait()

        assertInTransaction(result, StakingInfo, 'UnstakeInit', {
          amount: web3.utils.toWei('900').toString(),
          validatorId: '2'
        })
      })
    })

    describe('when validator is slashed to 0', function () {
      const validatorAddr = wallets[1].getChecksumAddressString()
      const slashedValidatorId = 2

      before(doDeploy)
      before(async function () {
        const slashingInfoList = [[slashedValidatorId, new BN(stakeAmount), '0x1']]
        await updateSlashedAmounts([wallets[0], wallets[1]], wallets[1], 1, slashingInfoList, slashingManager)
      })

      it('validator must have 0 amount', async function () {
        assertBigNumberEquality(await stakeManager.validatorStake(slashedValidatorId), '0')
      })

      it('validator must be unstaked within current epoch', async function () {
        const validatorData = await stakeManager.validators(slashedValidatorId)
        assertBigNumberEquality(validatorData.deactivationEpoch, await stakeManager.currentEpoch())
      })

      it('validator must not be jailed', async function () {
        const validatorData = await stakeManager.validators(slashedValidatorId)
        assertBigNumberEquality(validatorData.jailTime, '0')
      })

      it('checkpoint must go through with only unslashed validators', async function () {
        await checkPoint([wallets[0]], wallets[0], stakeManager)
      })

      it('slashed validator must be able to claim his stake', async function () {
        await stakeManager.advanceEpoch(DYNASTY)
        const stakeManagerValidator = stakeManager.connect(stakeManager.provider.getSigner(validatorAddr))
        const result = await (await stakeManagerValidator.unstakeClaim(slashedValidatorId)).wait()
        assertInTransaction(result, StakingInfo, 'Unstaked', {
          user: validatorAddr,
          validatorId: new BN(slashedValidatorId).toString(),
          amount: '0'
        })
      })
    })
  })
})
describe('Slashing:delegation', async function () {
  let stakeToken
  let stakeManager
  let slashingManager
  let wallets
  let stakingInfo

  describe('validator:delegator slashing', async function () {
    beforeEach(async function () {
      wallets = generateFirstWallets(mnemonics, 10)
      let contracts = await deployer.deployStakeManager(wallets)
      stakeToken = contracts.stakeToken
      stakeManager = contracts.stakeManager
      slashingManager = contracts.slashingManager
      stakingInfo = contracts.stakingInfo

      await contracts.governance.update(
        stakeManager.address,
        stakeManager.interface.encodeFunctionData('updateDynastyValue', [8])
      )
      await contracts.governance.update(
        stakeManager.address,
        stakeManager.interface.encodeFunctionData('updateCheckPointBlockInterval', [1])
      )

      await stakeManager.changeRootChain(wallets[0].getAddressString())
      const amount = web3.utils.toWei('1002')
      const stakeAmount = web3.utils.toWei('1000')
      const heimdallFee = web3.utils.toWei('2')
      for (let i = 0; i < 2; i++) {
        await stakeToken.mint(wallets[i].getAddressString(), amount)
        const stakeToken_i = stakeToken.connect(stakeToken.provider.getSigner(i))
        await stakeToken_i.approve(stakeManager.address, amount)

        const stakeManager_i = stakeManager.connect(stakeManager.provider.getSigner(i))
        await stakeManager_i.stakeFor(
          wallets[i].getAddressString(),
          stakeAmount,
          heimdallFee,
          true,
          wallets[i].getPublicKeyString()
        )
      }
      await stakeToken.mint(stakeManager.address, web3.utils.toWei('1000000')) // rewards amount
    })

    it('should slash validators and delegators', async function () {
      let validator = await stakeManager.validators(2)
      const validatorContract = await ValidatorShare.attach(validator.contractAddress)
      const delegator = wallets[3].getAddressString()
      await stakeToken.mint(delegator, web3.utils.toWei('250'))
      const stakeTokenDelegator = stakeToken.connect(stakeToken.provider.getSigner(delegator))
      await stakeTokenDelegator.approve(stakeManager.address, web3.utils.toWei('250'))
      await buyVoucher(validatorContract, web3.utils.toWei('250'), delegator)
      const amount = +web3.utils.toWei('100')

      const slashingInfoList = [
        [1, amount, '0x0'],
        [2, amount, '0x0']
      ]

      const result = await (
        await updateSlashedAmounts([wallets[0], wallets[1]], wallets[1], 1, slashingInfoList, slashingManager)
      ).wait()
      const logs = logDecoder.decodeLogs(result.events, stakingInfo.interface)
      logs.should.have.lengthOf(3)
      logs[0].event.should.equal('Slashed')
      assertBigNumberEquality(logs[0].args.amount, web3.utils.toWei('200'))
      const validator1 = await stakeManager.validators(1)
      validator = await stakeManager.validators(2)

      assertBigNumberEquality(validator1.amount, web3.utils.toWei('900'))
      assertBigNumberEquality(validator.delegatedAmount, web3.utils.toWei('230'))
    })
  })
})
