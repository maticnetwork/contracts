import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'

import { DepositManagerMock, RootToken } from '../helpers/contracts'
import EVMRevert from '../helpers/EVMRevert'

// add chai pluggin
chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
  .should()

contract('DepositManager', async function(accounts) {
  let depositManager
  let owner
  let rootToken
  let childToken
  let amount

  beforeEach(async function() {
    owner = accounts[0]
    amount = web3.toWei(10) // 10 tokens
    depositManager = await DepositManagerMock.new({ from: owner })
    rootToken = await RootToken.new('Root Token', 'ROOT')
    childToken = await RootToken.new('Child Token', 'CHILD')

    // map token
    await depositManager.mapToken(rootToken.address, childToken.address)
  })

  it('should allow anyone to deposit token', async function() {
    const user = accounts[1]

    // mint root token
    await rootToken.mint(user, amount)
    await rootToken.approve(depositManager.address, amount, {
      from: user
    })

    // deposit tokens
    const receipt = await depositManager.deposit(
      rootToken.address,
      user,
      amount,
      {
        from: user
      }
    )

    receipt.logs.should.have.lengthOf(1)
    receipt.logs[0].event.should.equal('Deposit')
    receipt.logs[0].args._user.should.equal(user)
    receipt.logs[0].args._token.should.equal(rootToken.address)
    receipt.logs[0].args._amount.should.be.bignumber.equal(amount)

    const contractBalance = await rootToken.balanceOf(depositManager.address)
    contractBalance.should.be.bignumber.equal(amount)
  })
})
