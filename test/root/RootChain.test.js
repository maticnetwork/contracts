import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import ethUtils from 'ethereumjs-util'
import encode from 'ethereumjs-abi'

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

  it('try to submitHeaderBlock with negative vote(`00` prefix) and fail', async function () {
    const validators = [1, 2, 3, 4]
    let tree = await rewradsTree(validators, accountState)
    const { data, sigs } = buildSubmitHeaderBlockPaylod(
      accounts[0],
      0,
      255,
      '' /* root */,
      wallets,
      { allValidators: true, rewardsRootHash: tree.getRoot(), getSigs: true, totalStake: totalStake, sigPrefix: '0x00' }
    )
    try {
      await rootChain.submitHeaderBlock(data, sigs)
      assert.fail('Expected the tx to revert')
    } catch (error) {
      const invalidOpcode = error.message.search('revert') >= 0
      assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
    }
  })

  it('submitHeaderBlock', async function () {
    const validators = [1, 2, 3, 4]
    let tree = await rewradsTree(validators, accountState)
    const { data, sigs } = buildSubmitHeaderBlockPaylod(
      accounts[0],
      0,
      255,
      '' /* root */,
      wallets,
      { allValidators: true, rewardsRootHash: tree.getRoot(), getSigs: true, totalStake: totalStake }
    )
    const result = await rootChain.submitHeaderBlock(data, sigs)
    const logs = result.logs
    logs.should.have.lengthOf(1)
    logs[0].event.should.equal('NewHeaderBlock')
    expect(logs[0].args).to.include({
      proposer: accounts[0],
      root: ethUtils.bufferToHex(ethUtils.keccak256(encode(0, 255)))
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
      payload.data,
      payload.sigs
    )

    let currentEpoch = await stakeManager.currentEpoch()
    payload = buildSubmitHeaderBlockPaylod(accounts[0], 5, 9, '', wallets, {
      rewardsRootHash: tree.getRoot(),
      getSigs: true,
      totalStake: totalStake
    })
    await rootChain.submitHeaderBlock(
      payload.data,
      payload.sigs
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
      payload.data,
      payload.sigs
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
      payload.data,
      payload.sigs
    )

    let currentEpoch = await stakeManager.currentEpoch()
    payload = buildSubmitHeaderBlockPaylod(accounts[0], 5, 9, '', wallets, {
      rewardsRootHash: tree.getRoot(),
      getSigs: true,
      totalStake: totalStake
    })
    await rootChain.submitHeaderBlock(
      payload.data,
      payload.sigs
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
      payload.data,
      payload.sigs
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
    const data =
      '0x0000000000000000000000009fb29aac15b9a4b7f17c3385939b007540f4d791000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ffc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470106892eb745427a56784350628942f5a3188adf722a7cf7b319cb59d43c23cc40000000000000000000000000000000000000000000000000000000000003a99'
    const sigs =
      '0x8ce241ded1d88588091af7bd68926d4dca1986f0b6b34f536887be4ecbb220c73331950cbab6844696e4c62f535a16360dbc30b6c2355de24e4ddf2e905c6b281b59d85a75d436789ae6cd2b5c565e720cc096c7953b3f04bfc3bcf928e9d981020c60005d4cca6ff23ec7952a469b1a61c2753a7500d9683ce567ed093dd673f31c8093b5b0af8c0a8e188c8742ac7b57bc362fd39155437613c0b0b879c9570b3764c9d42fc10386a51d922757dc49ba5ff6782e90bc595636ebe0202e65bf87231cb432f0020b58821df9bce79368e14e677e51b27b9f09c77b8e8ee0a8e7065c841495d34e6985493b3bdd66228a37a362612780da546fd870535d0bb1376a99e71b'
    const result = await rootChain.submitHeaderBlock(data, sigs)
    const logs = result.logs
    logs.should.have.lengthOf(1)
    logs[0].event.should.equal('NewHeaderBlock')
    expect(logs[0].args).to.include({
      proposer: '0x9fB29AAc15b9A4B7F17c3385939b007540f4d791',
      root: '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
    })
    assertBigNumberEquality(logs[0].args.headerBlockId, '10000')
    assertBigNumberEquality(logs[0].args.start, '0')
    assertBigNumberEquality(logs[0].args.end, '255')
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
