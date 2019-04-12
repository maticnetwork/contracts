import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import utils from 'ethereumjs-util'
import encode from 'ethereumjs-abi'
import BN from 'bn.js'

import deployer from './helpers/deployer.js'
import { encodeSigs, getSigs, assertBigNumberEquality, assertBigNumbergt } from './helpers/utils.js'
import { generateFirstWallets, mnemonics } from './helpers/wallets.js'

chai
  .use(chaiAsPromised)
  .use(require('chai-bn')(BN))
  .should()

contract("RootChain", async function(accounts) {
  let rootChain, wallets

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
    const contracts = await deployer.freshDeploy()
    rootChain = contracts.rootChain
  })

  it("submitHeaderBlock", async function() {
    const {vote, sigs, extraData, root} = buildSubmitHeaderBlockPaylod(accounts[0], 0, 22, wallets)
    const result = await rootChain.submitHeaderBlock(vote, sigs, extraData)
    const logs = result.logs;
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

  it("submit multiple headerBlocks", async function() {
    let payload = buildSubmitHeaderBlockPaylod(accounts[0], 0, 4, wallets)
    await rootChain.submitHeaderBlock(payload.vote, payload.sigs, payload.extraData)

    payload = buildSubmitHeaderBlockPaylod(accounts[0], 5, 9, wallets)
    await rootChain.submitHeaderBlock(payload.vote, payload.sigs, payload.extraData)

    payload = buildSubmitHeaderBlockPaylod(accounts[0], 10, 14, wallets)
    await rootChain.submitHeaderBlock(payload.vote, payload.sigs, payload.extraData)

    let block = await rootChain.headerBlocks('10000')
    assertBigNumbergt(block.createdAt, '0')

    block = await rootChain.headerBlocks('20000')
    assertBigNumbergt(block.createdAt, '0')
    
    block = await rootChain.headerBlocks('30000')
    assertBigNumbergt(block.createdAt, '0')
    
    block = await rootChain.headerBlocks('40000')
    assertBigNumberEquality(block.createdAt, '0');
  })

  it("createDepositBlock is ACLed on onlyDepositManager", async function() {
    try {
      await rootChain.createDepositBlock(accounts[0], accounts[1], 1)
      assert.fail('should have failed with UNAUTHORIZED_DEPOSIT_MANAGER_ONLY.');
    } catch(e) {
      expect(e.reason).to.equal('UNAUTHORIZED_DEPOSIT_MANAGER_ONLY')
    }
  })
})

function buildSubmitHeaderBlockPaylod(proposer, start, end, wallets) {
    const root = utils.keccak256(encode(start, end)) // dummy root
    // [proposer, start, end, root]
    const extraData = utils.bufferToHex(utils.rlp.encode([proposer, start, end, root]))
    const vote = utils.bufferToHex(
      // [chain, roundType, height, round, voteType, keccak256(bytes20(sha256(extraData)))]
      utils.rlp.encode([
        'test-chain-E5igIA', 'vote', 0, 0, 2,
        utils.bufferToHex(utils.sha256(extraData)).slice(0, 42)
      ])
    )
    const validators = [wallets[1], wallets[2], wallets[3]]

    const sigs = utils.bufferToHex(
      encodeSigs(getSigs(validators, utils.keccak256(vote)))
    )
    return {vote, sigs, extraData, root}
}