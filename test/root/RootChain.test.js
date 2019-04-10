import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'
import utils from 'ethereumjs-util'
import encode from 'ethereumjs-abi'
import BN from 'bn.js';

import { RootChain } from '../helpers/contracts.js';
import deployer from '../helpers/deployer.js';
// import { linkLibs, encodeSigs, getSigs, ZeroAddress } from '../helpers/utils.js'
import { encodeSigs, getSigs } from '../helpers/utils.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'

chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
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
    rootChain = await deployer.deployRootChain()
  })

  it("submitHeaderBlock", async function() {
    const proposer = accounts[0];
    const root = utils.keccak256(encode(0, 22)) // dummy root
    // [proposer, start, end, root]
    const extraData = utils.bufferToHex(utils.rlp.encode([proposer, 0, 22, root]))
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

    const result = await rootChain.submitHeaderBlock(vote, sigs, extraData)
    const logs = result.logs;
    logs.should.have.lengthOf(1)
    logs[0].event.should.equal('NewHeaderBlock')
    expect(logs[0].args).to.include({
      proposer,
      root: '0x' + root.toString('hex')
    })
    expect(logs[0].args.headerBlockId.eq(new BN('10000'))).to.be.true;
    expect(logs[0].args.start.eq(new BN('0'))).to.be.true;
    expect(logs[0].args.end.eq(new BN('22'))).to.be.true;
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