import chai from 'chai'
import utils from 'ethereumjs-util'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../helpers/deployer.js'
import { accTree } from '../helpers/proofs.js'
import { DummyERC20, DelegationManager, Staker } from '../helpers/artifacts'

import {
  assertBigNumbergt,
  assertBigNumberEquality,
  buildSubmitHeaderBlockPaylod,
  checkPoint,
  ZeroAddress
} from '../helpers/utils.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'
import { LogDecoder } from '../helpers/log-decoder'

chai.use(chaiAsPromised).should()

contract('DelegationManager', async function (accounts) {
  let stakeManager, delegationManager, wallets, stakeToken, registry
  let logDecoder = new LogDecoder([DelegationManager._json.abi, DummyERC20._json.abi, Staker._json.abi])

  before(async function () {
    wallets = generateFirstWallets(mnemonics, 10)
  })

  beforeEach(async function () {
    const contracts = await deployer.freshDeploy({ stakeManager: true })
    // setToken
    stakeManager = contracts.stakeManager
    delegationManager = contracts.delegationManager
    registry = contracts.registry
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

  it('stake', async function () {
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
    const logs = logDecoder.decodeLogs(result.receipt.rawLogs)

    logs[1].event.should.equal('Staked')
    logs[1].args.user.toLowerCase().should.equal(delegator)
    assertBigNumberEquality(logs[1].args.amount, amount)
  })

  it('stake and bond/unbond', async function () {
    const amount = web3.utils.toWei('200')
    for (let i = 0; i < 3; i++) {
      const user = wallets[i].getAddressString()
      // approve tranfer
      await stakeToken.approve(stakeManager.address, amount, {
        from: user
      })
      // stake now
      await stakeManager.stake(amount, 0, user, true, {
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
      let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
      logs[1].event.should.equal('Bonding')
    }

    result = await delegationManager.unBond(4, {
      from: wallets[3].getAddressString()
    })

    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    logs[0].event.should.equal('UnBonding')
  })

  it('reStake', async function () {
    const amount = web3.utils.toWei('200')
    const user = wallets[1].getAddressString()
    // approve tranfer
    await stakeToken.approve(stakeManager.address, amount, {
      from: user
    })
    // stake now
    await stakeManager.stake(amount, 0, user, true, {
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

    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // TODO: once dummyToken is gone logs[0] =transfer event
    logs[0].event.should.equal('ReStaked')
    assertBigNumberEquality(logs[0].args.amount, amount)

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
    logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    logs[0].event.should.equal('ReStaked')
    assertBigNumberEquality(logs[0].args.amount, amount)

    data = await delegationManager.delegators('2')
    assertBigNumberEquality(data.amount, web3.utils.toWei('600'))
  })

  it('claimRewards and withdrawRewards', async function () {
    const amount = web3.utils.toWei('200')
    const user = wallets[1].getAddressString()
    // approve tranfer
    await stakeToken.approve(stakeManager.address, amount, {
      from: user
    })
    // stake now
    await stakeManager.stake(amount, 0, user, true, {
      from: user
    })
    let delegator = wallets[2].getAddressString()
    // approve tranfer
    await stakeToken.approve(delegationManager.address, amount, {
      from: delegator
    })

    // stake now
    await delegationManager.stake(amount, 1, {
      from: delegator
    })
    delegator = wallets[3].getAddressString()
    // approve tranfer
    await stakeToken.approve(delegationManager.address, amount, {
      from: delegator
    })
    // stake now
    await delegationManager.stake(amount, 1, {
      from: delegator
    })

    const stakers = [2, 3]
    let accountState = [[2, 10, 0], [3, 20, 0]] // [delegatorId, rewardAmount, slashedAmount]
    let tree = await accTree(stakers, accountState)

    const { vote, sigs } = buildSubmitHeaderBlockPaylod(
      accounts[0],
      0,
      22,
      '' /* root */,
      [wallets[1]],
      { delegationAccRoot: tree.getRoot(), allValidators: true, getSigs: true }
    )

    const checkPoint = await stakeManager.currentEpoch()
    // 2/3 majority vote
    await stakeManager.checkSignatures(
      1,
      utils.bufferToHex(utils.keccak256(vote)),
      utils.bufferToHex(tree.getRoot()),
      sigs, { from: wallets[0].getAddressString() }
    )

    const leaf = utils.keccak256(
      web3.eth.abi.encodeParameters(
        ['uint256', 'uint256', 'uint256'],
        accountState[0]
      )
    )

    const delegatorState = await delegationManager.delegators(2)

    await delegationManager.claimRewards(
      2, // delegatorId
      accountState[0][1], // rewardAmount
      accountState[0][2], // slashedAmount
      0,
      false, // toWithdraw
      utils.bufferToHex(Buffer.concat(tree.getProof(leaf))) // accProof
    )

    const delegatorStateNew = await delegationManager.delegators(2)
    assertBigNumbergt(delegatorStateNew.claimedRewards, delegatorState.claimedRewards)
    const beforeBalance = await stakeToken.balanceOf(wallets[2].getAddressString())
    await delegationManager.withdrawRewards(2)
    const afterBalance = await stakeToken.balanceOf(wallets[2].getAddressString())
    assertBigNumbergt(afterBalance, beforeBalance)
  })

  it('claimRewards with withdrawRewards flag', async function () {
    const amount = web3.utils.toWei('200')
    const user = wallets[1].getAddressString()
    // approve tranfer
    await stakeToken.approve(stakeManager.address, amount, {
      from: user
    })
    // stake now
    await stakeManager.stake(amount, 0, user, true, {
      from: user
    })
    let delegator = wallets[2].getAddressString()
    // approve tranfer
    await stakeToken.approve(delegationManager.address, amount, {
      from: delegator
    })

    // stake now
    await delegationManager.stake(amount, 1, {
      from: delegator
    })
    delegator = wallets[3].getAddressString()
    // approve tranfer
    await stakeToken.approve(delegationManager.address, amount, {
      from: delegator
    })
    // stake now
    await delegationManager.stake(amount, 1, {
      from: delegator
    })

    const stakers = [2, 3]
    let accountState = [[2, 10, 0], [3, 20, 0]] // [delegatorId, rewardAmount, slashedAmount]
    let tree = await accTree(stakers, accountState)

    const { vote, sigs } = buildSubmitHeaderBlockPaylod(
      accounts[0],
      0,
      22,
      '' /* root */,
      [wallets[1]],
      { delegationAccRoot: tree.getRoot(), allValidators: true, getSigs: true }
    )

    const checkPoint = await stakeManager.currentEpoch()
    // 2/3 majority vote
    await stakeManager.checkSignatures(
      1,
      utils.bufferToHex(utils.keccak256(vote)),
      utils.bufferToHex(tree.getRoot()),
      sigs, { from: wallets[0].getAddressString() }
    )

    const leaf = utils.keccak256(
      web3.eth.abi.encodeParameters(
        ['uint256', 'uint256', 'uint256'],
        accountState[0]
      )
    )
    const beforeBalance = await stakeToken.balanceOf(wallets[2].getAddressString())
    await delegationManager.claimRewards(
      2, // delegatorId
      accountState[0][1], // rewardAmount
      accountState[0][2], // slashedAmount
      0,
      true, // toWithdraw
      utils.bufferToHex(Buffer.concat(tree.getProof(leaf))) // accProof
    )

    const afterBalance = await stakeToken.balanceOf(wallets[2].getAddressString())
    assertBigNumbergt(afterBalance, beforeBalance)
  })

  it('unstake and unstakeClaim', async function () {
    const amount = web3.utils.toWei('200')
    const user = wallets[1].getAddressString()
    await stakeManager.updateDynastyValue(2)
    // approve tranfer
    await stakeToken.approve(stakeManager.address, amount, {
      from: user
    })
    // stake now
    await stakeManager.stake(amount, 0, user, true, {
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
    let logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    logs[0].event.should.equal('UnBonding')
    // unstaking without unbonding
    let withdrawDelay = await stakeManager.WITHDRAWAL_DELAY()
    let w = [wallets[1]]
    for (let i = 0; i < withdrawDelay; i++) {
      await checkPoint(w, wallets[0], stakeManager)
    }

    // function unstakeClaim(
    //   uint256 checkpointId,// checkpoint Id  with root of proofs
    //   uint256 delegatorId,
    //   uint256 rewardAmount,
    //   uint256 slashedAmount,
    //   uint256 accIndex,
    //   uint256 withdrawIndex,
    //   bytes memory accProof,
    //   bytes memory withdrawProof
    //   ) public onlyDelegator(delegatorId) {

    // result = await delegationManager.unstakeClaim(2, { from: delegator })
    // console.log(result.receipt.rawLogs)
    // logs = logDecoder.decodeLogs(result.receipt.rawLogs)
    // console.log(logs)
    // logs[0].event.should.equal('Transfer')
    // should burn NFT

    // logs[0].args.to.toLowerCase().should.equal(ZeroAddress)
    // logs[1].event.should.equal('Transfer') dummtoken no transfer event
    // logs[1].event.should.equal('Unstaked')
    // assertBigNumberEquality(logs[1].args.amount, amount)
  })
})
