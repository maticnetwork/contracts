import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import { rewradsTree } from '../helpers/proofs.js'
import deployer from '../helpers/deployer.js'
import { DummyERC20 } from '../helpers/artifacts.js'
import {
  assertBigNumberEquality,
  assertBigNumbergt,
  buildSubmitHeaderBlockPaylod
} from '../helpers/utils.js'
import logDecoder from '../helpers/log-decoder.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'

chai.use(chaiAsPromised).should()

contract('RootChain', async function (accounts) {
  let rootChain

  let wallets

  let stakeManager

  let stakeToken

  let accountState = {}
  let totalStake

  before(async function () {
    const stakes = {
      1: web3.utils.toWei('1000'),
      2: web3.utils.toWei('1000'),
      3: web3.utils.toWei('1000'),
      4: web3.utils.toWei('1000')
    }
    totalStake = web3.utils.toWei('3000')
    wallets = generateFirstWallets(mnemonics, Object.keys(stakes).length)
  })

  beforeEach(async function () {
    const contracts = await deployer.freshDeploy({ stakeManager: true })
    rootChain = contracts.rootChain
    stakeManager = contracts.stakeManager
    stakeToken = await DummyERC20.new('Stake Token', 'STAKE')
    await stakeManager.setToken(stakeToken.address)
    await stakeManager.changeRootChain(rootChain.address)
    await stakeManager.updateCheckPointBlockInterval(1)

    let amount = web3.utils.toWei('1000')
    for (let i = 0; i < 4; i++) {
      await stakeToken.mint(wallets[i].getAddressString(), amount)
      await stakeToken.approve(stakeManager.address, amount, {
        from: wallets[i].getAddressString()
      })
      await stakeManager.stake(amount, 0, wallets[i].getAddressString(), false, {
        from: wallets[i].getAddressString()
      })
      accountState[i + 1] = 0
    }
  })

  it('submitHeaderBlock', async function () {
    const validators = [1, 2, 3, 4]
    let tree = await rewradsTree(validators, accountState)
    const { vote, sigs, extraData, root } = buildSubmitHeaderBlockPaylod(
      accounts[0],
      0,
      22,
      '' /* root */,
      wallets,
      { rewardsRootHash: tree.getRoot(), getSigs: true, totalStake: totalStake }
    )
    const result = await rootChain.submitHeaderBlock(vote, sigs, extraData)
    const logs = result.logs
    logs.should.have.lengthOf(1)
    logs[0].event.should.equal('NewHeaderBlock')
    expect(logs[0].args).to.include({
      proposer: accounts[0],
      root: '0x' + root.toString('hex')
    })
    assertBigNumberEquality(logs[0].args.headerBlockId, '10000')
    assertBigNumberEquality(logs[0].args.start, '0')
    assertBigNumberEquality(logs[0].args.end, '22')
  })

  it('submit multiple headerBlocks', async function () {
    let tree = await rewradsTree([1, 2, 3, 4], accountState)
    let payload = buildSubmitHeaderBlockPaylod(accounts[0], 0, 4, '', wallets, {
      rewardsRootHash: tree.getRoot(),
      getSigs: true,
      allValidators: true,
      totalStake: totalStake
    })
    await rootChain.submitHeaderBlock(
      payload.vote,
      payload.sigs,
      payload.extraData
    )

    let currentEpoch = await stakeManager.currentEpoch()
    payload = buildSubmitHeaderBlockPaylod(accounts[0], 5, 9, '', wallets, {
      rewardsRootHash: tree.getRoot(),
      getSigs: true,
      totalStake: totalStake
    })
    await rootChain.submitHeaderBlock(
      payload.vote,
      payload.sigs,
      payload.extraData
    )
    let newCurrentEpoch = await stakeManager.currentEpoch()
    assertBigNumbergt(newCurrentEpoch, currentEpoch)

    currentEpoch = newCurrentEpoch
    payload = buildSubmitHeaderBlockPaylod(accounts[0], 10, 14, '', wallets, {
      rewardsRootHash: tree.getRoot(),
      getSigs: true,
      totalStake: totalStake
    })
    await rootChain.submitHeaderBlock(
      payload.vote,
      payload.sigs,
      payload.extraData
    )
    newCurrentEpoch = await stakeManager.currentEpoch()
    assertBigNumbergt(newCurrentEpoch, currentEpoch)

    let block = await rootChain.headerBlocks('10000')
    assertBigNumbergt(block.createdAt, '0')

    block = await rootChain.headerBlocks('20000')
    assertBigNumbergt(block.createdAt, '0')

    block = await rootChain.headerBlocks('30000')
    assertBigNumbergt(block.createdAt, '0')

    block = await rootChain.headerBlocks('40000')
    assertBigNumberEquality(block.createdAt, '0')
  })

  it('updateDepositId is ACLed on onlyDepositManager', async function () {
    try {
      await rootChain.updateDepositId(1)
      assert.fail('should have failed with UNAUTHORIZED_DEPOSIT_MANAGER_ONLY')
    } catch (e) {
      expect(e.reason).to.equal('UNAUTHORIZED_DEPOSIT_MANAGER_ONLY')
    }
  })
})

contract('submitHeaderBlock hardcoded params', async function (accounts) {
  let rootChain

  beforeEach(async function () {
    const contracts = await deployer.freshDeploy()
    rootChain = contracts.rootChain
  })

  it('submitHeaderBlock (with hardcoded data)', async function () {
    const vote =
      '0xf48f6865696d64616c6c2d503572587767028080a0f32d8ebfa20332eb02d5bf1611758dde784112dd2750c594b9fe2a432fcf924e'
    const sigs =
      '0xa587122b0874cf8c86d2e4e14e65ff24cb582faff67d22ab39d2864a826cfc273c7fe1e98d5c3a30a6ffcdc12fb848e8e00d1c727baa00f89c1672ff5b1a69ee1b0b9059f8a901d2092e9987078d9a87bfb7ce89da14bccd8ed396bf0cf450e9ea22396ad482d69501dcf515d6f9c304ca87258f020e7a8ddc58d63998176a6f2f1c986144e59406cb18cb4cef89987d1a805c2725645126730c08b59ba92619e2155c4379b7eeeb5448081af34b970ccf407c906121b3921b3458a831f69ce12cf31c'
    const txData =
      '0xf872f870949fb29aac15b9a4b7f17c3385939b007540f4d7918016a0c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470a0106892eb745427a56784350628942f5a3188adf722a7cf7b319cb59d43c23cc49634303030303030303030303030303030303030303030'
    const result = await rootChain.submitHeaderBlock(vote, sigs, txData)
    const logs = result.logs
    logs.should.have.lengthOf(1)
    logs[0].event.should.equal('NewHeaderBlock')
    expect(logs[0].args).to.include({
      proposer: '0x9fB29AAc15b9A4B7F17c3385939b007540f4d791',
      root: '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
    })
    assertBigNumberEquality(logs[0].args.headerBlockId, '10000')
    assertBigNumberEquality(logs[0].args.start, '0')
    assertBigNumberEquality(logs[0].args.end, '22')
  })
})
