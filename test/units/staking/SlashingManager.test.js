import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deployer from '../../helpers/deployer.js'
import logDecoder from '../../helpers/log-decoder.js'
import { ValidatorShareTest } from '../../helpers/artifacts'

import {
  checkPoint,
  updateSlashedAmounts,
  assertBigNumbergt,
  assertBigNumberEquality
} from '../../helpers/utils.js'
import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'
import { buyVoucher } from './ValidatorShareHelper.js'

chai.use(chaiAsPromised).should()

contract('Slashing:validator', async function(accounts) {
  let stakeToken
  let stakeManager
  let slashingManager
  let wallets

  describe('validator slashing', async function() {
    beforeEach(async function() {
      wallets = generateFirstWallets(mnemonics, 10)
      let contracts = await deployer.deployStakeManager(wallets)
      stakeToken = contracts.stakeToken
      stakeManager = contracts.stakeManager
      slashingManager = contracts.slashingManager

      await stakeManager.updateDynastyValue(8)
      await stakeManager.updateCheckPointBlockInterval(1)
      await stakeManager.changeRootChain(wallets[0].getAddressString())
      const amount = web3.utils.toWei('1002')
      const stakeAmount = web3.utils.toWei('1000')
      const heimdallFee = web3.utils.toWei('2')
      for (let i = 0; i < 2; i++) {
        await stakeToken.mint(wallets[i].getAddressString(), amount)
        await stakeToken.approve(stakeManager.address, amount, {
          from: wallets[i].getAddressString()
        })
        await stakeManager.stake(stakeAmount, heimdallFee, false, wallets[i].getPublicKeyString(), {
          from: wallets[i].getAddressString()
        })
      }
      await stakeToken.mint(stakeManager.address, web3.utils.toWei('1000000'))// rewards amount
    })

    it('should slash validators', async function() {
      const amount = +web3.utils.toWei('100')
      const slashingInfoList = [[1, amount, '0x0'], [2, amount, '0x0']]

      const result = await updateSlashedAmounts([wallets[0], wallets[1]], wallets[1], 1, slashingInfoList, slashingManager)
      const logs = logDecoder.decodeLogs(result.receipt.rawLogs)
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('Slashed')
      assertBigNumberEquality(logs[0].args.amount, web3.utils.toWei('200'))
      const validator1 = await stakeManager.validators(1)
      const validator2 = await stakeManager.validators(2)
      assertBigNumberEquality(validator1.amount, web3.utils.toWei('900'))
      assertBigNumberEquality(validator2.amount, web3.utils.toWei('900'))
    })

    it('should slash validator:jail and send checkpoint', async function() {
      const amount = +web3.utils.toWei('100')
      const validator1Wallet = wallets[0]
      const slashingInfoList = [[2, amount, '0x1']]

      const result = await updateSlashedAmounts([wallets[0], wallets[1]], wallets[1], 1, slashingInfoList, slashingManager)

      const logs = logDecoder.decodeLogs(result.receipt.rawLogs)
      logs.should.have.lengthOf(2)
      logs[0].event.should.equal('Jailed')
      logs[1].event.should.equal('Slashed')
      assertBigNumberEquality(logs[1].args.amount, web3.utils.toWei('100'))
      const validator1 = await stakeManager.validators(1)
      const validator2 = await stakeManager.validators(2)
      assertBigNumberEquality(validator2.amount, web3.utils.toWei('900'))
      assert.equal(await stakeManager.isValidator(2), false)
      assertBigNumberEquality(await stakeManager.currentValidatorSetTotalStake(), validator1.amount)
      await checkPoint([validator1Wallet], validator1Wallet, stakeManager)
      const val1AfterCheckpoint = await stakeManager.validators(1)
      assertBigNumbergt(val1AfterCheckpoint.reward, validator1.reward)
      assertBigNumberEquality(val1AfterCheckpoint.reward, web3.utils.toWei('10000'))
    })

    it('should test jail/unjail', async function() {
      const amount = +web3.utils.toWei('100')
      const validator1Wallet = wallets[0]
      const validator2Wallet = wallets[1]
      const slashingInfoList = [[2, amount, '0x1']]

      await updateSlashedAmounts([wallets[0], wallets[1]], wallets[1], 1, slashingInfoList, slashingManager)

      await checkPoint([validator1Wallet], validator1Wallet, stakeManager)
      await stakeManager.unjail(2, { from: validator2Wallet.getAddressString() })
      assert.equal(await stakeManager.isValidator(2), true)
      await checkPoint([validator1Wallet, validator2Wallet], validator1Wallet, stakeManager)
      const validator2 = await stakeManager.validators(2)
      assertBigNumbergt(validator2.reward, web3.utils.toWei('4260')) // 4700-10% proposer bonus
    })

    it('should test jail => unstake', async function() {
      const amount = +web3.utils.toWei('100')
      const validator2Wallet = wallets[1]
      const slashingInfoList = [[2, amount, '0x1']]

      await updateSlashedAmounts([wallets[0], wallets[1]], wallets[1], 1, slashingInfoList, slashingManager)

      const result = await stakeManager.unstake(2, { from: validator2Wallet.getAddressString() })

      const logs = logDecoder.decodeLogs(result.receipt.rawLogs)
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('UnstakeInit')
      assertBigNumberEquality(logs[0].args.amount, web3.utils.toWei('900'))
      assertBigNumberEquality(logs[0].args.validatorId, '2')
    })
  })
})
contract('Slashing:delegation', async function(accounts) {
  let stakeToken
  let stakeManager
  let slashingManager
  let wallets

  describe('validator:delegator slashing', async function() {
    beforeEach(async function() {
      wallets = generateFirstWallets(mnemonics, 10)
      let contracts = await deployer.deployStakeManager(wallets)
      stakeToken = contracts.stakeToken
      stakeManager = contracts.stakeManager
      slashingManager = contracts.slashingManager

      await stakeManager.updateDynastyValue(8)
      await stakeManager.updateCheckPointBlockInterval(1)
      await stakeManager.changeRootChain(wallets[0].getAddressString())
      const amount = web3.utils.toWei('1002')
      const stakeAmount = web3.utils.toWei('1000')
      const heimdallFee = web3.utils.toWei('2')
      for (let i = 0; i < 2; i++) {
        await stakeToken.mint(wallets[i].getAddressString(), amount)
        await stakeToken.approve(stakeManager.address, amount, {
          from: wallets[i].getAddressString()
        })
        await stakeManager.stake(stakeAmount, heimdallFee, true, wallets[i].getPublicKeyString(), {
          from: wallets[i].getAddressString()
        })
      }
      await stakeToken.mint(stakeManager.address, web3.utils.toWei('1000000'))// rewards amount
    })

    it('should slash validators and delegators', async function() {
      let validator = await stakeManager.validators(2)
      const validatorContract = await ValidatorShareTest.at(validator.contractAddress)
      const delegator = wallets[3].getAddressString()
      await stakeToken.mint(
        delegator,
        web3.utils.toWei('250')
      )
      await stakeToken.approve(stakeManager.address, web3.utils.toWei('250'), {
        from: delegator
      })
      let result = await buyVoucher(validatorContract, web3.utils.toWei('250'), delegator)
      const amount = +web3.utils.toWei('100')

      const slashingInfoList = [[1, amount, '0x0'], [2, amount, '0x0']]

      result = await updateSlashedAmounts([wallets[0], wallets[1]], wallets[1], 1, slashingInfoList, slashingManager)
      const logs = logDecoder.decodeLogs(result.receipt.rawLogs)
      logs.should.have.lengthOf(1)
      logs[0].event.should.equal('Slashed')
      assertBigNumberEquality(logs[0].args.amount, web3.utils.toWei('200'))
      const validator1 = await stakeManager.validators(1)
      assertBigNumberEquality(validator1.amount, web3.utils.toWei('900'))
      let delegationAmount = await validatorContract.activeAmount()
      assertBigNumberEquality(delegationAmount, web3.utils.toWei('230'))
    })
  })
})
