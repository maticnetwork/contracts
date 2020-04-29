import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import ethUtils from 'ethereumjs-util'

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
    totalStake = web3.utils.toWei('4000')
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

    let amount = web3.utils.toWei('1002')
    let heimdallFee = web3.utils.toWei('2')
    let stakedAmount = web3.utils.toWei('1000')

    for (let i = 0; i < 4; i++) {
      await stakeToken.mint(wallets[i].getAddressString(), amount)
      await stakeToken.approve(stakeManager.address, amount, {
        from: wallets[i].getAddressString()
      })
      await stakeManager.stake(stakedAmount, heimdallFee, false, wallets[i].getPublicKeyString(), {
        from: wallets[i].getAddressString()
      })
      accountState[i + 1] = 0
    }
  })

  it.only('submitHeaderBlock side-channel', async function () { 
    
    const data = ethUtils.bufferToHex(0000000000000000000000006c468cf8c9879006e22ec4029696e005c2319c9d00000000000000000000000000000000000000000000000000000000000028280000000000000000000000000000000000000000000000000000000000002c2704a94567dc56e7aa3552b890c776aedd2b00513919777d2cdee9c20d3fe9be50d10b5c16c25efe0b0f5b3d75038834223934ae8c2ec2b63a62bbe42aa21e2d2dd94de22b9798ab592e2c1befd8bd16405c9d17b70fb615031bde6d74545e217c)
    const sigs = ethUtils.bufferToHex(37417cd1947b4939f0c344ac9b79a231a45c9815677fb6a22e8e9416247833e54204cf00ab341edc56768d83195256e98374f40a946d79df6d2431ca5f25bab800)

    await rootChain.submitHeaderBlock(data, sigs)
    const logs = result.logs
    console.log(logs)
  })

  it('submitHeaderBlock', async function () {
    const validators = [1, 2, 3, 4]
    let tree = await rewradsTree(validators, accountState)
    const { vote, sigs, extraData, root } = buildSubmitHeaderBlockPaylod(
      accounts[0],
      0,
      255,
      '' /* root */,
      wallets,
      { allValidators: true, rewardsRootHash: tree.getRoot(), getSigs: true, totalStake: totalStake }
    )
    const result = await rootChain.submitHeaderBlock(vote, sigs, extraData)
    const logs = result.logs
    logs.should.have.lengthOf(1)
    logs[0].event.should.equal('NewHeaderBlock')
    expect(logs[0].args).to.include({
      proposer: accounts[0],
      root: '0x' + root.toString('hex')
    })

    assertBigNumberEquality(logs[0].args.reward, await stakeManager.CHECKPOINT_REWARD())
    assertBigNumberEquality(logs[0].args.headerBlockId, '10000')
    assertBigNumberEquality(logs[0].args.start, '0')
    assertBigNumberEquality(logs[0].args.end, '255')
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

  it('revert checkpoints', async function () {
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
    expect(block.start.toString()).to.equal('0')
    expect(block.end.toString()).to.equal('4')

    block = await rootChain.headerBlocks('20000')
    expect(block.start.toString()).to.equal('5')
    expect(block.end.toString()).to.equal('9')

    block = await rootChain.headerBlocks('30000')
    expect(block.start.toString()).to.equal('10')
    expect(block.end.toString()).to.equal('14')

    await rootChain.setNextHeaderBlock(20000)

    block = await rootChain.headerBlocks('10000')
    expect(block.start.toString()).to.equal('0')
    expect(block.end.toString()).to.equal('4')

    block = await rootChain.headerBlocks('20000')
    expect(block.start.toString()).to.equal('0')
    expect(block.end.toString()).to.equal('0')

    block = await rootChain.headerBlocks('30000')
    expect(block.start.toString()).to.equal('0')
    expect(block.end.toString()).to.equal('0')

    block = await rootChain.headerBlocks('40000')
    expect(block.start.toString()).to.equal('0')
    expect(block.end.toString()).to.equal('0')
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

function printBlock(block) {
  console.log({
    start: block.start.toString(),
    end: block.end.toString(),
    root: block.root,
    createdAt: block.createdAt.toString(),
  })
}
