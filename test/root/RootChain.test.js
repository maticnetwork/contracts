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
      '0xf48f6865696d64616c6c2d503572587767028080a0cfa2cdbd860e93a65fa5195b9ea9a0e3a7247c9be95349c004c7e55091266209'
    const sigs =
      '0x8c011c04810e7ad6a48520bc2ef99b208d49f6e3763476b72b8050c4d4448b4038ad4455645ca7f36d20ea320337594b6d788c56b6a95317d89714e0a648aa091ce820957f29f8d1cffe2fe6d42cc07301cdc3b8d2a408a55558d0151a4aa85b544bcba1d502433d3d0c1d4fff6c4d794e82f1107dec13ba18815c954b9b268fd81cfcbc315d906515f2a0aacd19574e0cafcc76ca3c63bf0291618c227e03ce9b7f163f509c8e68bcc7e31b81fe7aab81ec591d4338da8906a466c1d8b2b7538de61c'
    const txData =
      '0xf85bf859949fb29aac15b9a4b7f17c3385939b007540f4d7918016a0c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470a0106892eb745427a56784350628942f5a3188adf722a7cf7b319cb59d43c23cc4'
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
