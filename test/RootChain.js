import bip39 from 'bip39'
import utils from 'ethereumjs-util'
import hdkey from 'ethereumjs-wallet/hdkey'
import {Buffer} from 'safe-buffer'

import assertRevert from './helpers/assertRevert.js'

const BN = utils.BN
const rlp = utils.rlp

let ECVerify = artifacts.require('./lib/ECVerify.sol')
let RLP = artifacts.require('./lib/RLP.sol')
let PatriciaUtils = artifacts.require('./lib/PatriciaUtils.sol')
let SafeMath = artifacts.require('./lib/SafeMath.sol')

let RootChain = artifacts.require('./RootChain.sol')
let TestToken = artifacts.require('./TestToken.sol')

function generateFirstWallets(n, hdPathIndex = 0) {
  const hdwallet = hdkey.fromMasterSeed(
    bip39.mnemonicToSeed(
      'clock radar mass judge dismiss just intact mind resemble fringe diary casino'
    )
  )

  const result = []
  for (let i = 0; i < n; i++) {
    const node = hdwallet.derivePath(`m/44'/60'/0'/0/${i + hdPathIndex}`)
    result.push({
      privateKey: node.getWallet().getPrivateKeyString(),
      address: node.getWallet().getAddressString()
    })
  }

  return result
}

contract('RootChain', async function(accounts) {
  async function linkLibs() {
    const libContracts = {
      ECVerify: await ECVerify.new(),
      RLP: await RLP.new(),
      PatriciaUtils: await PatriciaUtils.new(),
      SafeMath: await SafeMath.new()
    }

    Object.keys(libContracts).forEach(key => {
      RootChain.link(key, libContracts[key].address)
    })
  }

  function getSigs(wallets, _chain, _root, _start, _end, exclude = []) {
    let chain = utils.toBuffer(_chain)
    let start = new BN(_start.toString()).toArrayLike(Buffer, 'be', 32)
    let end = new BN(_end.toString()).toArrayLike(Buffer, 'be', 32)
    let headerRoot = utils.toBuffer(_root)
    const h = utils.toBuffer(
      utils.sha3(Buffer.concat([chain, headerRoot, start, end]))
    )

    return wallets
      .map(w => {
        if (exclude.indexOf(w.address) === -1) {
          const vrs = utils.ecsign(h, utils.toBuffer(w.privateKey))
          return utils.toRpcSig(vrs.v, vrs.r, vrs.s)
        }
      })
      .filter(d => d)
  }

  function encodeSigs(sigs = []) {
    return rlp.encode(sigs)
  }

  describe('initialization', async function() {
    let stakingToken
    let rootChainContract

    before(async function() {
      // link libs
      await linkLibs(accounts[0])

      stakingToken = await TestToken.new()
      rootChainContract = await RootChain.new(stakingToken.address, {
        from: accounts[0]
      })
    })

    it('should set token address and owner properly', async function() {
      assert.equal(await rootChainContract.stakeToken(), stakingToken.address)
    })

    it('should set owner properly', async function() {
      assert.equal(await rootChainContract.owner(), accounts[0])
    })
  })

  // wallets
  describe('Wallets', async function() {
    it('should create wallets for first 5 accounts', async function() {
      const wallets = generateFirstWallets(5)
      assert(wallets.length == 5)
      assert(wallets[1].address == accounts[1])
      assert(wallets[2].address == accounts[2])
      assert(wallets[3].address == accounts[3])
    })
  })

  // staking
  describe('Admin: staking', async function() {
    let stakingToken
    let rootChainContract
    let wallets

    before(async function() {
      wallets = generateFirstWallets(5)

      // link libs
      await linkLibs(accounts[0])

      stakingToken = await TestToken.new()
      rootChainContract = await RootChain.new(stakingToken.address, {
        from: accounts[0]
      })

      // transfer tokens to other accounts
      await stakingToken.transfer(wallets[1].address, web3.toWei(100))
      await stakingToken.transfer(wallets[2].address, web3.toWei(100))
      await stakingToken.transfer(wallets[3].address, web3.toWei(100))
      await stakingToken.transfer(wallets[4].address, web3.toWei(100))
    })

    it('should set the validator threshold to 2', async function() {
      const receipt = await rootChainContract.updateValidatorThreshold(2)
      assert.equal(receipt.logs.length, 1)
      assert.equal(receipt.logs[0].event, 'ThresholdChange')
      assert.equal(+receipt.logs[0].args.newThreshold, 2)
      assert.equal(parseInt(await rootChainContract.validatorThreshold()), 2)
    })

    it('should stake via wallets[1]', async function() {
      const user = wallets[1].address
      const amount = web3.toWei(1)

      // approve tranfer
      await stakingToken.approve(rootChainContract.address, amount, {
        from: user
      })

      // stake now
      await rootChainContract.stake(amount, {from: user})

      // check amount and stake sum
      assert.equal(await rootChainContract.totalStake(), amount)
      assert.equal(await rootChainContract.getStake(user), amount)
    })

    it('should stake via wallets[2]', async function() {
      const user = wallets[2].address
      const amount = web3.toWei(5)

      // approve tranfer
      await stakingToken.approve(rootChainContract.address, amount, {
        from: user
      })

      // stake now
      await rootChainContract.stake(amount, {from: user})

      // check amount and stake sum
      assert.equal(await rootChainContract.totalStake(), web3.toWei(6))
      assert.equal(await rootChainContract.getStake(user), amount)
    })

    it('should stake via wallets[3]', async function() {
      const user = wallets[3].address
      const amount = web3.toWei(20)

      // approve tranfer
      await stakingToken.approve(rootChainContract.address, amount, {
        from: user
      })

      // stake now
      await rootChainContract.stake(amount, {from: user})

      // check amount and stake sum
      assert.equal(await rootChainContract.totalStake(), web3.toWei(26))
      assert.equal(await rootChainContract.getStake(user), amount)
    })

    it('should stake via wallets[4]', async function() {
      const user = wallets[4].address
      const amount = web3.toWei(100)

      // approve tranfer
      await stakingToken.approve(rootChainContract.address, amount, {
        from: user
      })

      // stake now
      await rootChainContract.stake(amount, {from: user})

      // check amount and stake sum
      assert.equal(await rootChainContract.totalStake(), web3.toWei(126))
      assert.equal(await rootChainContract.getStake(user), amount)
    })

    it('should destake a small amount from wallets[4]', async() => {
      const user = wallets[4].address

      // destake
      await rootChainContract.destake(web3.toWei(26), {from: user})

      // check amount and stake sum
      assert.equal(await rootChainContract.totalStake(), web3.toWei(126 - 26))
      assert.equal(await rootChainContract.getStake(user), web3.toWei(100 - 26))
    })

    it('should get the proposer and make sure it is a staker', async() => {
      const proposer = await rootChainContract.getProposer()
      assert.isOk(
        proposer === wallets[1].address ||
          proposer === wallets[2].address ||
          proposer === wallets[3].address ||
          proposer === wallets[4].address
      )
    })
  })

  describe('Stakers: header block', async function() {
    let stakingToken
    let rootChainContract
    let wallets
    let stakes = {
      1: web3.toWei(1),
      2: web3.toWei(10),
      3: web3.toWei(20),
      4: web3.toWei(50)
    }
    let chain
    let dummyRoot
    let sigs

    before(async function() {
      wallets = generateFirstWallets(Object.keys(stakes).length)

      // link libs
      await linkLibs(accounts[0])

      stakingToken = await TestToken.new()
      rootChainContract = await RootChain.new(stakingToken.address, {
        from: accounts[0]
      })

      for (var i = 1; i < wallets.length; i++) {
        const amount = stakes[i]
        const user = wallets[i].address

        // get tokens
        await stakingToken.transfer(user, amount)

        // approve transfer
        await stakingToken.approve(rootChainContract.address, amount, {
          from: user
        })

        // stake
        await rootChainContract.stake(amount, {from: user})
      }

      // increase threshold to 2
      await rootChainContract.updateValidatorThreshold(2)

      chain = await rootChainContract.chain()
      dummyRoot = utils.bufferToHex(utils.sha3('dummy'))
    })

    it('should create sigs properly', async function() {
      sigs = utils.bufferToHex(
        encodeSigs(
          getSigs(wallets.slice(1), chain, 1, 10, dummyRoot, [
            await rootChainContract.getProposer()
          ])
        )
      )

      const signers = await rootChainContract.checkSignatures(
        dummyRoot,
        1,
        10,
        sigs
      )

      // total sigs = wallet.length - proposer - owner
      assert.equal(signers.toNumber(), wallets.length - 2)

      // current header block
      const currentHeaderBlock = await rootChainContract.currentHeaderBlock()
      assert.equal(+currentHeaderBlock, 0)

      // check current child block
      const currentChildBlock = await rootChainContract.currentChildBlock()
      assert.equal(+currentChildBlock, 0)
    })

    it('should not allow proposer to submit block', async function() {
      // submit header block
      const receipt = await rootChainContract.submitHeaderBlock(
        dummyRoot,
        10,
        sigs
      )

      assert.equal(receipt.logs.length, 1)
      assert.equal(receipt.logs[0].event, 'NewHeaderBlock')
      assert.equal(receipt.logs[0].args.proposer, accounts[0])
      assert.equal(+receipt.logs[0].args.start, 1)
      assert.equal(+receipt.logs[0].args.end, 10)
      assert.equal(receipt.logs[0].args.root, dummyRoot)

      // current header block
      const currentHeaderBlock = await rootChainContract.currentHeaderBlock()
      assert.equal(+currentHeaderBlock, 1)

      // current child block
      const currentChildBlock = await rootChainContract.currentChildBlock()
      assert.equal(+currentChildBlock, 10)
    })
  })
})
