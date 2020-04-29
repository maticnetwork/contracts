import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import { rewradsTree } from '../../helpers/proofs.js'
import deployer from '../../helpers/deployer.js'
import { DummyERC20 } from '../../helpers/artifacts.js'
import {
  assertBigNumberEquality,
  assertBigNumbergt,
  buildSubmitHeaderBlockPaylod
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
    const contracts = await deployer.freshDeploy({ stakeManager: true })
    rootChain = contracts.rootChain
    stakeManager = contracts.stakeManager
    stakeToken = await DummyERC20.new('Stake Token', 'STAKE')
    await stakeManager.setToken(stakeToken.address)
    await stakeManager.changeRootChain(rootChain.address)
    await stakeManager.updateCheckPointBlockInterval(1)

    let amount = web3.utils.toWei('1000')
    for (let i = 0; i < validatorsCount; i++) {
      await stakeToken.mint(wallets[i].getAddressString(), amount)
      await stakeToken.approve(stakeManager.address, amount, {
        from: wallets[i].getAddressString()
      })
      await stakeManager.stake(amount, 0, false, wallets[i].getPublicKeyString(), {
        from: wallets[i].getAddressString()
      })
      accountState[i + 1] = 0
      validators.push(i + 1)
    }

    this.reward = await stakeManager.CHECKPOINT_REWARD()
  }

  function testCheckpoint(dontBuildHeaderBlockPayload) {
    before(async function() {
      if (!dontBuildHeaderBlockPayload) {
        let tree = await rewradsTree(validators, accountState)
        const { vote, sigs, extraData, root } = buildSubmitHeaderBlockPaylod(
          this.proposer,
          this.start,
          this.end,
          '' /* root */,
          wallets,
          { allValidators: true, rewardsRootHash: tree.getRoot(), getSigs: true, totalStake: totalStake }
        )

        this.vote = vote
        this.sigs = sigs
        this.extraData = extraData
        this.root = root
      }
      
      this.currentEpoch = await stakeManager.currentEpoch()
    })

    it('must submit', async function() {
      this.result = await rootChain.submitHeaderBlock(this.vote, this.sigs, this.extraData)
    })

    it('must emit NewBlockHeader', async function() {
      await expectEvent(this.result, 'NewHeaderBlock', {
        proposer: this.proposer,
        root: '0x' + this.root.toString('hex'),
        reward: this.reward,
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

  describe('submitHeaderBlock', function() {
    describe('1 header block', function() {
      before(freshDeploy)
      before(function() {
        this.start = 0
        this.end = 255
        this.headerBlockId = '10000'
        this.proposer = accounts[0]
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
        })

        testCheckpoint()
      })
      
      describe('submit [5..9] blocks', async function() {
        before(function() {
          this.start = 5
          this.end = 9
          this.headerBlockId = '20000'
          this.proposer = accounts[0]
        })

        testCheckpoint()
      })

      describe('submit [10..14] blocks', async function() {
        before(function() {
          this.start = 10
          this.end = 14
          this.headerBlockId = '30000'
          this.proposer = accounts[0]
        })

        testCheckpoint()
      })
    })

    describe('with hardcoded params', async function() {
      before(freshDeploy)

      before(function() {
        this.reward = '7500000000000000000000'
        this.start = 0
        this.end = 22
        this.headerBlockId = '10000'
        this.proposer = '0x9fB29AAc15b9A4B7F17c3385939b007540f4d791'
        this.root = 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
        this.sigs = '0xa587122b0874cf8c86d2e4e14e65ff24cb582faff67d22ab39d2864a826cfc273c7fe1e98d5c3a30a6ffcdc12fb848e8e00d1c727baa00f89c1672ff5b1a69ee1b0b9059f8a901d2092e9987078d9a87bfb7ce89da14bccd8ed396bf0cf450e9ea22396ad482d69501dcf515d6f9c304ca87258f020e7a8ddc58d63998176a6f2f1c986144e59406cb18cb4cef89987d1a805c2725645126730c08b59ba92619e2155c4379b7eeeb5448081af34b970ccf407c906121b3921b3458a831f69ce12cf31c'
        this.vote = '0xf48f6865696d64616c6c2d503572587767028080a0f32d8ebfa20332eb02d5bf1611758dde784112dd2750c594b9fe2a432fcf924e'
        this.extraData = '0xf872f870949fb29aac15b9a4b7f17c3385939b007540f4d7918016a0c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470a0106892eb745427a56784350628942f5a3188adf722a7cf7b319cb59d43c23cc49634303030303030303030303030303030303030303030'
      })

      testCheckpoint(true)
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
      })

      testCheckpoint()
    })
    
    describe('submit [5..9] blocks', async function() {
      before(function() {
        this.start = 5
        this.end = 9
        this.headerBlockId = '20000'
        this.proposer = accounts[0]
      })

      testCheckpoint()
    })

    describe('submit [10..14] blocks', async function() {
      before(function() {
        this.start = 10
        this.end = 14
        this.headerBlockId = '30000'
        this.proposer = accounts[0]
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
        const maxDeposits = await rootChain.MAX_DEPOSITS()
        await expectRevert(rootChain.updateDepositId(maxDeposits.add(new BN(1))), 'UNAUTHORIZED_DEPOSIT_MANAGER_ONLY')
      })
    })
  })
})
