import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../helpers/deployer.js'
import logDecoder from '../../helpers/log-decoder.js'
import * as utils from '../../helpers/utils'

import { expectRevert } from '@openzeppelin/test-helpers'

const crypto = require('crypto')

chai
  .use(chaiAsPromised)
  .should()

contract('DepositManager', async function(accounts) {
  const amount = web3.utils.toBN('10').pow(web3.utils.toBN('18'))

  async function deployRootChain() {
    await deployer.deployRootChain()
    this.depositManager = await deployer.deployDepositManager()
  }

  function validateDepositBlock(depositBlock, owner, token, amountOrNFTId) {
    depositBlock.should.to.include({ owner, token })
    utils.assertBigNumberEquality(depositBlock.amountOrNFTId, amountOrNFTId)
  }
  
  function validateDepositHash(depositHash, owner, token, amountOrNFTId) {
    depositHash.should.be.equal(web3.utils.soliditySha3(owner, token, amountOrNFTId))
  }

  describe('when not paused', async function() {
    before(async function() {
      await deployer.freshDeploy()
    })

    function depositTest(depositFn, erc721) {
      it('must deposit', async function() {
        this.result = await depositFn.call(this)
        this.logs = logDecoder.decodeLogs(this.result.receipt.rawLogs)
      })

      if (erc721) {
        it('must have 3 logs', function() {
          this.logs.should.have.lengthOf(3)
          this.depositBlock = this.logs[2]
        })
      } else {
        it('must have 4 logs', function() {
          this.logs.should.have.lengthOf(4)
          this.depositBlock = this.logs[3]
        })
      }

      it('must emit NewDepositBlock', function() {
        this.depositBlock.event.should.equal('NewDepositBlock')
      })

      it(`depositBlockId == 1`, function() {
        this.depositBlock.args.depositBlockId.toString().should.be.equal('1')
      })

      it('must have valid deposit hash from event', function() {
        validateDepositBlock(this.depositBlock.args, this.user, this.tokenAddr, this.depositPayload)
      })

      it('must have valid deposit hash from chain', async function() {
        const depositHash = (await this.depositManager.deposits(1)).depositHash
        validateDepositHash(depositHash, this.user, this.tokenAddr, this.depositPayload)
      })
    }

    describe('depositEther', async function() {
      before(deployRootChain)
      before(async function() {
        this.maticWeth = await deployer.deployMaticWeth()
        this.tokenAddr = this.maticWeth.address
        this.depositPayload = web3.utils.toWei('1', 'ether')
        this.user = accounts[0]
      })

      depositTest(async function() {
        return this.depositManager.depositEther({
          value: this.depositPayload,
          from: this.user
        })
      })
    })

    describe('depositERC20', async function() {
      before(deployRootChain)
      before(async function() {
        const testToken = await deployer.deployTestErc20()
        await testToken.approve(this.depositManager.address, amount)

        this.tokenAddr = testToken.address
        this.depositPayload = amount
        this.user = accounts[0]
      })

      depositTest(async function() {
        return this.depositManager.depositERC20(this.tokenAddr, this.depositPayload)
      })
    })

    describe('depositERC20ForUser', async function() {
      before(deployRootChain)
      before(async function() {
        const testToken = await deployer.deployTestErc20()
        await testToken.approve(this.depositManager.address, amount)

        this.tokenAddr = testToken.address
        this.depositPayload = amount
        this.user = accounts[1]
      })

      depositTest(async function() {
        return this.depositManager.depositERC20ForUser(this.tokenAddr, this.user, this.depositPayload)
      })
    })

    describe('depositERC721', async function() {
      before(deployRootChain)
      before(async function() {
        const testToken = await deployer.deployTestErc721()
        let tokenId = '1212'
        await testToken.mint(tokenId)
        await testToken.approve(this.depositManager.address, tokenId)

        this.tokenAddr = testToken.address
        this.depositPayload = tokenId
        this.user = accounts[0]
      })

      depositTest(async function() {
        return this.depositManager.depositERC721(this.tokenAddr, this.depositPayload)
      }, true)
    })

    describe('depositERC721ForUser', async function() {
      before(deployRootChain)
      before(async function() {
        const testToken = await deployer.deployTestErc721()
        let tokenId = '1234'
        await testToken.mint(tokenId)
        await testToken.approve(this.depositManager.address, tokenId)

        this.tokenAddr = testToken.address
        this.depositPayload = tokenId
        this.user = accounts[1]
      })

      depositTest(async function() {
        return this.depositManager.depositERC721ForUser(this.tokenAddr, this.user, this.depositPayload)
      }, true)
    })

    describe('depositBulk', async function() {
      const tokens = []
      const amounts = []
      const NUM_DEPOSITS = 15
      const user = accounts[1]
      let logs

      before(deployRootChain)
      before(async function() {
        for (let i = 0; i < NUM_DEPOSITS; i++) {
          const testToken = await deployer.deployTestErc20()
          const _amount = amount.add(web3.utils.toBN(i))
          await testToken.approve(this.depositManager.address, _amount)
          tokens.push(testToken.address)
          amounts.push(_amount)
        }
        for (let i = 0; i < NUM_DEPOSITS; i++) {
          const testToken = await deployer.deployTestErc721()
          const tokenId = web3.utils.toBN(crypto.randomBytes(32).toString('hex'), 16)
          await testToken.mint(tokenId)
          await testToken.approve(this.depositManager.address, tokenId)
          tokens.push(testToken.address)
          amounts.push(tokenId)
        }
      })

      it('must deposit successfully', async function() {
        const result = await this.depositManager.depositBulk(tokens, amounts, user)
        logs = logDecoder.decodeLogs(result.receipt.rawLogs)
      })

      describe('erc20 transfers', function() {
        for (let i = 0; i < NUM_DEPOSITS; i++) {
          describe(`deposit #${i}`, function() {
            let logIndex = i * 4
            let log
            before(function() {
              log = logs[logIndex + 3]
            })

            it(`must emit Transfer`, function() {
              logs[logIndex].event.should.be.equal('Transfer')
            })

            it(`must emit NewDepositBlock`, function() {
              log.event.should.equal('NewDepositBlock')
            })

            it(`depositBlockId == ${i + 1}`, function() {
              log.args.depositBlockId.toString().should.be.equal((i + 1).toString())
            })

            it(`must have valid deposit hash from event`, function() {
              validateDepositBlock(log.args, user, tokens[i], amounts[i])
            })

            it(`must have valid deposit hash from event from chain`, async function() {
              const depositHash = (await this.depositManager.deposits(i + 1)).depositHash
              validateDepositHash(depositHash, user, tokens[i], amounts[i])
            })
          })
        }
      })

      describe('erc721 transfers', function() {
        // assert events for erc721 transfers
        for (let i = 0; i < NUM_DEPOSITS; i++) {
          describe(`deposit #${i}`, function() {
            /* add erc20 events */
            const logIndex = 4 * NUM_DEPOSITS + i * 3 // 2 logs per transfer - Transfer, StateSynced, NewDepositBlock
            const numTransfer = i + NUM_DEPOSITS
            let log

            before(function() {
              log = logs[logIndex + 2]
            })

            it(`must emit Transfer`, function() {
              logs[logIndex].event.should.be.equal('Transfer')
            })

            it(`must emit NewDepositBlock`, function() {
              log.event.should.equal('NewDepositBlock')
            })

            it(`depositBlockId == ${numTransfer + 1}`, function() {
              log.args.depositBlockId.toString().should.be.equal((numTransfer + 1).toString())
            })

            it(`must have valid deposit hash from event`, function() {
              validateDepositBlock(log.args, user, tokens[numTransfer], amounts[numTransfer])
            })

            it(`must have valid deposit hash from event from chain`, async function() {
              const depositHash = (await this.depositManager.deposits(numTransfer + 1)).depositHash
              validateDepositHash(depositHash, user, tokens[numTransfer], amounts[numTransfer])
            })
          })
        }
      })
    })

    it('onERC721Received')
    it('tokenFallback')
  })

  describe('when paused', async function() {
    before(async function() {
      this.contracts = await deployer.freshDeploy()
    })

    beforeEach(async function() {
      await deployer.deployRootChain()
      this.depositManager = await deployer.deployDepositManager()
    })

    describe('depositEther', async function() {
      const value = web3.utils.toWei('1', 'ether')

      beforeEach(async function() {
        await deployer.deployMaticWeth()
        await this.contracts.governance.update(
          this.depositManager.address,
          this.depositManager.contract.methods.lock().encodeABI()
        )
      })

      it('must revert', async function() {
        await expectRevert(this.depositManager.depositEther({
          value,
          from: accounts[0]
        }), 'Is Locked')
      })
    })

    describe('depositERC20', async function() {
      beforeEach(async function() {
        const testToken = await deployer.deployTestErc20()
        await testToken.approve(this.depositManager.address, amount)
        await this.contracts.governance.update(
          this.depositManager.address,
          this.depositManager.contract.methods.lock().encodeABI()
        )
        this.testToken = testToken
      })

      it('must revert', async function() {
        await expectRevert(this.depositManager.depositERC20(this.testToken.address, amount), 'Is Locked')
      })
    })

    describe('depositERC721 reverts', async function() {
      let tokenId = '1212'

      beforeEach(async function() {
        const testToken = await deployer.deployTestErc721()
        await testToken.mint(tokenId)
        await testToken.approve(this.depositManager.address, tokenId)
        await this.contracts.governance.update(
          this.depositManager.address,
          this.depositManager.contract.methods.lock().encodeABI()
        )

        this.testToken = testToken
      })
      
      it('must revert', async function() {
        await expectRevert(this.depositManager.depositERC721(this.testToken.address, tokenId), 'Is Locked')
      })
    })

    describe('depositBulk', async function() {
      const tokens = []
      const amounts = []
      const NUM_DEPOSITS = 15
      const user = accounts[1]

      beforeEach(async function() {
        for (let i = 0; i < NUM_DEPOSITS; i++) {
          const testToken = await deployer.deployTestErc20()
          const _amount = amount.add(web3.utils.toBN(i))
          await testToken.approve(this.depositManager.address, _amount)
          tokens.push(testToken.address)
          amounts.push(_amount)
        }
  
        for (let i = 0; i < NUM_DEPOSITS; i++) {
          const testToken = await deployer.deployTestErc721()
          const tokenId = web3.utils.toBN(crypto.randomBytes(32).toString('hex'), 16)
          await testToken.mint(tokenId)
          await testToken.approve(this.depositManager.address, tokenId)
          tokens.push(testToken.address)
          amounts.push(tokenId)
        }
        
        await this.contracts.governance.update(
          this.depositManager.address,
          this.depositManager.contract.methods.lock().encodeABI()
        )
      })
      
      it('must revert', async function() {
        await expectRevert(this.depositManager.depositBulk(tokens, amounts, user), 'Is Locked')
      })
    })
  })
})
