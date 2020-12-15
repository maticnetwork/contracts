import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../helpers/deployer.js'
import * as utils from '../../helpers/utils'

chai
  .use(chaiAsPromised)
  .should()

contract('Drainable', async function(accounts) {
  const amount = web3.utils.toBN('2').pow(web3.utils.toBN('18'))

  async function freshDeploy() {
    this.contracts = await deployer.freshDeploy(accounts[0])
    await deployer.deployRootChain()
    this.depositManager = await deployer.deployDepositManager()
    let randomUser = await web3.eth.accounts.create()
    this.destination = randomUser.address
  }

  describe('drain assets from Deposit Manager', async function() {
    describe('ERC20', function() {
      async function testErc20Drain() {
        const tokens = []
        const values = []
        let testToken

        before(freshDeploy)
        before(async function() {
          testToken = await deployer.deployTestErc20()
          await testToken.transfer(this.depositManager.address, this.amount)

          tokens.push(testToken.address)
          values.push(this.drainAmount.toString())
        })
        
        describe('before drain', function() {
          it(`must have correct balance`, async function() {
            utils.assertBigNumberEquality(await testToken.balanceOf(this.depositManager.address), this.amount)
          })
        })

        describe('after drain', function() {
          before(async function() {
            this.drainable = await deployer.deployDrainable()
            const data = this.drainable.contract.methods.drainErc20(tokens, values, this.destination).encodeABI()
            await this.contracts.governance.update(
              this.drainable.address,
              data
            )
          })

          it(`drainable must have correct balance`, async function() {
            utils.assertBigNumberEquality(await testToken.balanceOf(this.drainable.address), amount.sub(this.drainAmount))
          })

          it(`destination must have correct balance`, async function() {
            utils.assertBigNumberEquality(await testToken.balanceOf(this.destination), this.drainAmount)
          })
        })
      }

      describe('complete drain', function() {
        before(function() {
          this.amount = amount
          this.drainAmount = amount
        })

        testErc20Drain()
      })

      describe('partial drain', function() {
        before(function() {
          this.amount = amount
          this.drainAmount = web3.utils.toBN('1').pow(web3.utils.toBN('18'))
        })

        testErc20Drain()
      })
    })

    describe('ERC721', function() {
      let tokenId = '1234'
      const tokens = []
      const values = []

      before(freshDeploy)
      before(async function() {
        const testToken = await deployer.deployTestErc721()
        await testToken.mint(tokenId)
        await testToken.transferFrom(accounts[0], this.depositManager.address, tokenId)
        this.testToken = testToken

        tokens.push(testToken.address)
        values.push(tokenId)
      })

      describe('before drain', function() {
        it(`depositManager must have ${tokenId} token`, async function() {
          await this.testToken.ownerOf(tokenId).should.eventually.equal(this.depositManager.address)
        })
      })

      describe('after drain', function() {
        before(async function() {
          this.drainable = await deployer.deployDrainable()
          const data = this.drainable.contract.methods.drainErc721(tokens, values, this.destination).encodeABI()
          await this.contracts.governance.update(
            this.drainable.address,
            data
          )
        })

        it(`destination must have ${tokenId} token`, async function() {
          await this.testToken.ownerOf(tokenId).should.eventually.equal(this.destination)
        })
      })
    })

    describe('Ether', async function() {
      function testEtherDrain() {
        before(freshDeploy)
        before(async function() {
          this.maticWeth = await deployer.deployMaticWeth()
          await web3.eth.sendTransaction({
            from: accounts[0],
            to: this.depositManager.address,
            value: this.amount.toString(),
            gas: 200000
          })
        })

        describe('before drain', function() {
          it('depositManager must have correct balance', async function() {
            utils.assertBigNumberEquality(await this.maticWeth.balanceOf(this.depositManager.address), this.amount)
          })
        })
  
        describe('after drain', function() {
          before(async function() {
            this.drainable = await deployer.deployDrainable()
            const data = this.drainable.contract.methods.drainEther(this.drainAmount.toString(), this.destination).encodeABI()
            await this.contracts.governance.update(
              this.drainable.address,
              data
            )
          })
  
          it('depositManager must have correct balance', async function() {
            utils.assertBigNumberEquality(await this.maticWeth.balanceOf(this.depositManager.address), this.amount.sub(this.drainAmount))
          })
  
          it('destination must have correct balance', async function() {
            utils.assertBigNumberEquality(await web3.eth.getBalance(this.destination), this.drainAmount)
          })
        })
      }

      describe('complete drain', function() {
        before(function() {
          this.amount = amount
          this.drainAmount = amount
        })

        testEtherDrain()
      })

      describe('partial amount', function() {
        before(function() {
          this.amount = amount
          this.drainAmount = web3.utils.toBN('1').pow(web3.utils.toBN('18'))
        })

        testEtherDrain()
      })
    })
  })
})
