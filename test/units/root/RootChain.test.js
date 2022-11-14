import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import ethUtils from 'ethereumjs-util'
import encode from 'ethereumjs-abi'

import { rewradsTree } from '../../helpers/proofs.js'
import deployer from '../../helpers/deployer.js'
import { TestToken, TransferWithSigPredicate } from '../../helpers/artifacts'
import {
  assertBigNumberEquality,
  assertBigNumbergt,
  buildsubmitCheckpointPaylod
} from '../../helpers/utils.js'
import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'
import { expectEvent, expectRevert, BN } from '@openzeppelin/test-helpers'

chai.use(chaiAsPromised).should()

contract('RootChain', async function(accounts) {
  let rootChain
  let wallets
  let stakeManager
  let stakeToken
  let accountState = {}
  let totalStake
  const validatorsCount = 4
  const validators = []

  before(async function() {
    const stakes = {
      1: web3.utils.toWei('1000'),
      2: web3.utils.toWei('1000'),
      3: web3.utils.toWei('1000'),
      4: web3.utils.toWei('1000')
    }

    totalStake = web3.utils.toWei('4000')
    wallets = generateFirstWallets(mnemonics, Object.keys(stakes).length)
  })

  async function freshDeploy() {
    const contracts = await deployer.deployStakeManager(wallets)
    rootChain = contracts.rootChain
    stakeManager = contracts.stakeManager
    stakeToken = await TestToken.new('Stake Token', 'STAKE')
    await stakeManager.setStakingToken(stakeToken.address)
    await stakeManager.changeRootChain(rootChain.address)
    await stakeManager.updateCheckPointBlockInterval(1)

    this.defaultHeimdallFee = new BN(web3.utils.toWei('1'))

    let amount = new BN(web3.utils.toWei('1000'))
    for (let i = 0; i < validatorsCount; i++) {
      const mintAmount = amount.add(this.defaultHeimdallFee)
      await stakeToken.mint(wallets[i].getAddressString(), mintAmount)

      await stakeToken.approve(stakeManager.address, mintAmount, {
        from: wallets[i].getAddressString()
      })

      await stakeManager.stakeFor(wallets[i].getAddressString(), amount, this.defaultHeimdallFee, false, wallets[i].getPublicKeyString(), {
        from: wallets[i].getAddressString()
      })
      accountState[i + 1] = 0
      validators.push(i + 1)
    }
  }

  function buildRoot(that) {
    return ethUtils.bufferToHex(ethUtils.keccak256(encode(that.start, that.end)))
  }

  function testCheckpoint(dontBuildHeaderBlockPayload) {
    before(async function() {
      if (!dontBuildHeaderBlockPayload) {
        let tree = await rewradsTree(validators, accountState)
        const { data, sigs } = buildsubmitCheckpointPaylod(
          this.proposer,
          this.start,
          this.end,
          this.root,
          wallets,
          { allValidators: true, rewardsRootHash: tree.getRoot(), getSigs: true, totalStake: totalStake }
        )

        this.data = data
        this.sigs = sigs
      }

      this.currentEpoch = await stakeManager.currentEpoch()
    })

    it('must submit', async function() {
      this.result = await rootChain.submitCheckpoint(this.data, this.sigs)
    })

    it('must emit NewBlockHeader', async function() {
      await expectEvent(this.result, 'NewHeaderBlock', {
        proposer: this.proposer,
        root: this.root,
        headerBlockId: this.headerBlockId,
        start: this.start.toString(),
        end: this.end.toString()
      })
    })

    it('epoch must advance', async function() {
      const newCurrentEpoch = await stakeManager.currentEpoch()
      assertBigNumbergt(newCurrentEpoch, this.currentEpoch)
      this.currentEpoch = newCurrentEpoch
    })

    it('header block createdAt == 0', async function() {
      let block = await rootChain.headerBlocks(this.headerBlockId)
      assertBigNumbergt(block.createdAt, '0')
    })
  }

  describe('submitCheckpoint', function() {
    describe('1 header block', function() {
      before(freshDeploy)
      before(function() {
        this.start = 0
        this.end = 255
        this.headerBlockId = '10000'
        this.proposer = accounts[0]
        this.root = buildRoot(this)
      })

      testCheckpoint()
    })

    describe('multiple header blocks', async function() {
      before(freshDeploy)

      describe('submit [0..4] blocks', async function() {
        before(function() {
          this.start = 0
          this.end = 4
          this.headerBlockId = '10000'
          this.proposer = accounts[0]
          this.root = buildRoot(this)
        })

        testCheckpoint()
      })

      describe('submit [5..9] blocks', async function() {
        before(function() {
          this.start = 5
          this.end = 9
          this.headerBlockId = '20000'
          this.proposer = accounts[0]
          this.root = buildRoot(this)
        })

        testCheckpoint()
      })

      describe('submit [10..14] blocks', async function() {
        before(function() {
          this.start = 10
          this.end = 14
          this.headerBlockId = '30000'
          this.proposer = accounts[0]
          this.root = buildRoot(this)
        })

        testCheckpoint()
      })
    })

    describe.skip('with hardcoded params', async function() {
      before(freshDeploy)

      before(async function() {
        this.reward = await stakeManager.CHECKPOINT_REWARD()
        this.start = 0
        this.end = 255
        this.headerBlockId = '10000'
        this.proposer = '0x9fB29AAc15b9A4B7F17c3385939b007540f4d791'
        this.root = '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
        this.sigs = '0x8ce241ded1d88588091af7bd68926d4dca1986f0b6b34f536887be4ecbb220c73331950cbab6844696e4c62f535a16360dbc30b6c2355de24e4ddf2e905c6b281b59d85a75d436789ae6cd2b5c565e720cc096c7953b3f04bfc3bcf928e9d981020c60005d4cca6ff23ec7952a469b1a61c2753a7500d9683ce567ed093dd673f31c8093b5b0af8c0a8e188c8742ac7b57bc362fd39155437613c0b0b879c9570b3764c9d42fc10386a51d922757dc49ba5ff6782e90bc595636ebe0202e65bf87231cb432f0020b58821df9bce79368e14e677e51b27b9f09c77b8e8ee0a8e7065c841495d34e6985493b3bdd66228a37a362612780da546fd870535d0bb1376a99e71b'
        this.data = '0x0000000000000000000000009fb29aac15b9a4b7f17c3385939b007540f4d791000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ffc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470106892eb745427a56784350628942f5a3188adf722a7cf7b319cb59d43c23cc40000000000000000000000000000000000000000000000000000000000003a99'
      })

      testCheckpoint(true)
    })

    describe('when blockInterval is less than checkPointBlockInterval', function() {
      before(freshDeploy)

      before(async function() {
        await stakeManager.updateCheckPointBlockInterval(2)

        this.start = 0
        this.end = 0
        this.headerBlockId = '10000'
        this.proposer = accounts[0]
        this.root = buildRoot(this)
      })

      testCheckpoint()
    })
  })

  describe('checkpoints reverting', async function() {
    before(freshDeploy)

    describe('submit [0..4] blocks', async function() {
      before(function() {
        this.start = 0
        this.end = 4
        this.headerBlockId = '10000'
        this.proposer = accounts[0]
        this.root = buildRoot(this)
      })

      testCheckpoint()
    })

    describe('submit [5..9] blocks', async function() {
      before(function() {
        this.start = 5
        this.end = 9
        this.headerBlockId = '20000'
        this.proposer = accounts[0]
        this.root = buildRoot(this)
      })

      testCheckpoint()
    })

    describe('submit [10..14] blocks', async function() {
      before(function() {
        this.start = 10
        this.end = 14
        this.headerBlockId = '30000'
        this.proposer = accounts[0]
        this.root = buildRoot(this)
      })

      testCheckpoint()
    })

    describe('setNextHeaderBlock', function() {
      it('must set header block to 20000', async function() {
        await rootChain.setNextHeaderBlock(20000)
      })
    })

    function testHeaderBlock(headerBlockId, start, end) {
      describe(`header block ${headerBlockId}`, function() {
        before(async function() {
          this.block = await rootChain.headerBlocks(headerBlockId)
        })

        it(`start == ${start}`, async function() {
          this.block.start.toString().should.be.equal(start.toString())
        })

        it(`end == ${end}`, async function() {
          this.block.end.toString().should.be.equal(end.toString())
        })
      })
    }

    testHeaderBlock('10000', 0, 4)
    testHeaderBlock('20000', 0, 0)
    testHeaderBlock('30000', 0, 0)
    testHeaderBlock('40000', 0, 0)
  })

  describe('updateDepositId', async function() {
    beforeEach(freshDeploy)

    describe('when from is not deposit manager', function() {
      it('must revert', async function() {
        await expectRevert(rootChain.updateDepositId(1), 'UNAUTHORIZED_DEPOSIT_MANAGER_ONLY')
      })
    })

    describe('when numDeposits > MAX_DEPOSITS', function() {
      it('must revert', async function() {
        // TODO add a root chain mock where MAX_DEPOSITS can be queried
        const maxDeposits = new BN('10000')
        await expectRevert(rootChain.updateDepositId(maxDeposits.add(new BN(1))), 'UNAUTHORIZED_DEPOSIT_MANAGER_ONLY')
      })
    })
  })
})
