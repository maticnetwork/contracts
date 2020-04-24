import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../../helpers/deployer.js'
import * as utils from '../../helpers/utils'

chai
  .use(chaiAsPromised)
  .should()

contract('Drainable', async function(accounts) {
  let depositManager, drainable, destination, drainAmount
  const amount = web3.utils.toBN('2').pow(web3.utils.toBN('18'))
  describe('drain assets from Deposit Manager', async function() {
    before(async function() {
      this.contracts = await deployer.freshDeploy()
    })
    beforeEach(async function() {
      await deployer.deployRootChain()
      depositManager = await deployer.deployDepositManager()
      let randomUser = await web3.eth.accounts.create()
      destination = randomUser.address
    })

    it('complete drain ERC20', async function() {
      const testToken = await deployer.deployTestErc20()
      await testToken.transfer(depositManager.address, amount)
      drainAmount = amount
      utils.assertBigNumberEquality(await testToken.balanceOf(depositManager.address), amount)

      const tokens = []
      const values = []

      tokens.push(testToken.address)
      values.push(drainAmount.toString())

      drainable = await deployer.deployDrainable()
      const data = drainable.contract.methods.drainErc20(tokens, values, destination).encodeABI()
      await this.contracts.governance.update(
        drainable.address,
        data
      )

      utils.assertBigNumberEquality(await testToken.balanceOf(drainable.address), amount.sub(drainAmount))
      utils.assertBigNumberEquality(await testToken.balanceOf(destination), drainAmount)
    })

    it('partial drain ERC20', async function() {
      const testToken = await deployer.deployTestErc20()
      await testToken.transfer(depositManager.address, amount)
      drainAmount = web3.utils.toBN('1').pow(web3.utils.toBN('18'))

      utils.assertBigNumberEquality(await testToken.balanceOf(depositManager.address), amount)

      const tokens = []
      const values = []

      tokens.push(testToken.address)
      values.push(drainAmount.toString())

      drainable = await deployer.deployDrainable()
      const data = drainable.contract.methods.drainErc20(tokens, values, destination).encodeABI()
      await this.contracts.governance.update(
        drainable.address,
        data
      )

      utils.assertBigNumberEquality(await testToken.balanceOf(drainable.address), amount.sub(drainAmount))
      utils.assertBigNumberEquality(await testToken.balanceOf(destination), drainAmount)
    })

    it('drain ERC721', async function() {
      const testToken = await deployer.deployTestErc721()
      let tokenId = '1234'
      await testToken.mint(tokenId)
      await testToken.transferFrom(accounts[0], depositManager.address, tokenId)
      await testToken.ownerOf(tokenId).should.eventually.equal(depositManager.address)
      const tokens = []
      const values = []
      tokens.push(testToken.address)
      values.push(tokenId)
      drainable = await deployer.deployDrainable()
      const data = drainable.contract.methods.drainErc721(tokens, values, destination).encodeABI()
      await this.contracts.governance.update(
        drainable.address,
        data
      )
      await testToken.ownerOf(tokenId).should.eventually.equal(destination)
    })

    it('complete drain Ether', async function() {
      const maticWeth = await deployer.deployMaticWeth()
      drainAmount = amount
      await web3.eth.sendTransaction({
        from: accounts[0],
        to: depositManager.address,
        value: amount.toString(),
        gas: 200000
      })

      utils.assertBigNumberEquality(await maticWeth.balanceOf(depositManager.address), amount)

      drainable = await deployer.deployDrainable()
      const data = drainable.contract.methods.drainEther(drainAmount.toString(), destination).encodeABI()
      await this.contracts.governance.update(
        drainable.address,
        data
      )

      utils.assertBigNumberEquality(await maticWeth.balanceOf(depositManager.address), amount.sub(drainAmount))
      utils.assertBigNumberEquality(await web3.eth.getBalance(destination), drainAmount)
    })

    it('partial drain Ether', async function() {
      const maticWeth = await deployer.deployMaticWeth()
      drainAmount = web3.utils.toBN('1').pow(web3.utils.toBN('18'))
      await web3.eth.sendTransaction({
        from: accounts[0],
        to: depositManager.address,
        value: amount.toString(),
        gas: 200000
      })

      utils.assertBigNumberEquality(await maticWeth.balanceOf(depositManager.address), amount)

      drainable = await deployer.deployDrainable()
      const data = drainable.contract.methods.drainEther(drainAmount.toString(), destination).encodeABI()
      await this.contracts.governance.update(
        drainable.address,
        data
      )

      utils.assertBigNumberEquality(await maticWeth.balanceOf(depositManager.address), amount.sub(drainAmount))
      utils.assertBigNumberEquality(await web3.eth.getBalance(destination), drainAmount)
    })
  })
})
