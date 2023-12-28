import testHelpers from '@openzeppelin/test-helpers'


describe('Initializable', function() {
  before(async function() {
    const ProxyTestImpl = await ethers.getContractFactory('ProxyTestImpl')
    this.impl = await ProxyTestImpl.deploy()
  })

  it('must initialize', async function() {
    await this.impl.init()
  })

  it('must revert when attempt to initialize again', async function() {
    await testHelpers.expectRevert(this.impl.init(), 'already inited')
  })
})
