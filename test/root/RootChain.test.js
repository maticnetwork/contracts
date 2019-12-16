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
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'

chai.use(chaiAsPromised).should()

contract('RootChain', async function (accounts) {
  let rootChain

  let wallets

  let stakeManager

  let stakeToken

  let accountState = {}

  before(async function () {
    const stakes = {
      1: web3.utils.toWei('101'),
      2: web3.utils.toWei('100'),
      3: web3.utils.toWei('100'),
      4: web3.utils.toWei('100')
    }
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
      await stakeManager.stake(amount, wallets[i].getAddressString(), false, {
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
      { rewardsRootHash: tree.getRoot(), getSigs: true }
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
      getSigs: true
    })
    await rootChain.submitHeaderBlock(
      payload.vote,
      payload.sigs,
      payload.extraData
    )

    let currentEpoch = await stakeManager.currentEpoch()
    payload = buildSubmitHeaderBlockPaylod(accounts[0], 5, 9, '', wallets, {
      rewardsRootHash: tree.getRoot(),
      getSigs: true
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
      getSigs: true
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
      '0xf48f6865696d64616c6c2d503572587767028080a0d34d582f79dc6c53d990ba3b79adfdfa7358aca85e24b1364db305dcb1b08844'
    const sigs =
      '0xc5d86b8969b78d3df7274454528f031de03e00c85799a818fa6ad58289f6bc0d4d16a49c1428ebe922bf50e10ed5159f2405ab50ef4cd033eb841707673d8ec51b08a35bf3f6cee1058bdb33d3ab02c0dda5d866c46429ea2ad5030f8534b41f5c14372c716a39745515513145d6b2f659cc30ad8e44193944b305fd3f2755edb51c2af28eb238574b44a9a4c68125fa38bd5cb8dbec4ff5598a5dcce0f1dc3cd4a65c43bbb4cd9c7fb1e64242329a34bc5c876620b1ce787d0c5e176d319aab3f351c'
    const txData =
      '0xf85df85b949fb29aac15b9a4b7f17c3385939b007540f4d7918016a0c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470a0106892eb745427a56784350628942f5a3188adf722a7cf7b319cb59d43c23cc48080'
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
