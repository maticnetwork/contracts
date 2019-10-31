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

contract('RootChain', async function(accounts) {
  let rootChain

  let wallets

  let stakeManager

  let stakeToken

  let accountState = {}

  before(async function() {
    const stakes = {
      1: web3.utils.toWei('101'),
      2: web3.utils.toWei('100'),
      3: web3.utils.toWei('100'),
      4: web3.utils.toWei('100')
    }
    wallets = generateFirstWallets(mnemonics, Object.keys(stakes).length)
  })

  beforeEach(async function() {
    const contracts = await deployer.freshDeploy({ stakeManager: true })
    rootChain = contracts.rootChain
    stakeManager = contracts.stakeManager
    stakeToken = await DummyERC20.new('Stake Token', 'STAKE')
    await stakeManager.setToken(stakeToken.address)
    await stakeManager.changeRootChain(rootChain.address)

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

  it('submitHeaderBlock', async function() {
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

  it('submit multiple headerBlocks', async function() {
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

    payload = buildSubmitHeaderBlockPaylod(accounts[0], 5, 9, '', wallets, {
      rewardsRootHash: tree.getRoot(),
      getSigs: true
    })
    await rootChain.submitHeaderBlock(
      payload.vote,
      payload.sigs,
      payload.extraData
    )

    payload = buildSubmitHeaderBlockPaylod(accounts[0], 10, 14, '', wallets, {
      rewardsRootHash: tree.getRoot(),
      getSigs: true
    })
    await rootChain.submitHeaderBlock(
      payload.vote,
      payload.sigs,
      payload.extraData
    )

    let block = await rootChain.headerBlocks('10000')
    assertBigNumbergt(block.createdAt, '0')

    block = await rootChain.headerBlocks('20000')
    assertBigNumbergt(block.createdAt, '0')

    block = await rootChain.headerBlocks('30000')
    assertBigNumbergt(block.createdAt, '0')

    block = await rootChain.headerBlocks('40000')
    assertBigNumberEquality(block.createdAt, '0')
  })

  it('updateDepositId is ACLed on onlyDepositManager', async function() {
    try {
      await rootChain.updateDepositId(1)
      assert.fail('should have failed with UNAUTHORIZED_DEPOSIT_MANAGER_ONLY')
    } catch (e) {
      expect(e.reason).to.equal('UNAUTHORIZED_DEPOSIT_MANAGER_ONLY')
    }
  })
})

contract('submitHeaderBlock hardcoded params', async function(accounts) {
  let rootChain

  beforeEach(async function() {
    const contracts = await deployer.freshDeploy()
    rootChain = contracts.rootChain
  })

  it('submitHeaderBlock (with hardcoded data)', async function() {
    const vote =
      '0xf48f6865696d64616c6c2d503572587767020d80a0f7225d5fbdaeec3e35d970c4d36bc0f2945241ac5de2f53a8b0703a318d6c892'
    const sigs =
      '0xd61890e6167518b0352515d45381be76508e6fb1d3abef80c9944e910984b14014d82f12eb133f613c1378efceb50356b5509a14b82f7715e9a0f48dbc8a432001'
    const txData =
      '0xf885f83f946c468cf8c9879006e22ec4029696e005c2319c9d808203ffa0fcaf3d0b2e32e20916c9f8c8bc2e8d89838fba5ea20885406e78767061305d4e845d7f51cfb841c3cd61fb7bb74b2ab89690be137d545418e9756fde4742fc2770edc5558ece682d3bf1ba90c11dfbaa1f84c0fa0c35af2ebfdd4632b7e69ab73f70aed1511a460080'
    const result = await rootChain.submitHeaderBlock(vote, sigs, txData)
    const logs = result.logs
    logs.should.have.lengthOf(1)
    logs[0].event.should.equal('NewHeaderBlock')
    expect(logs[0].args).to.include({
      proposer: '0x6c468CF8c9879006E22EC4029696E005C2319C9D',
      root: '0xfcaf3d0b2e32e20916c9f8c8bc2e8d89838fba5ea20885406e78767061305d4e'
    })
    assertBigNumberEquality(logs[0].args.headerBlockId, '10000')
    assertBigNumberEquality(logs[0].args.start, '0')
    assertBigNumberEquality(logs[0].args.end, '1023')
  })
})
