import { expectRevert } from '@openzeppelin/test-helpers'

const ProxyTestImpl = artifacts.require('ProxyTestImpl')

contract('Initializable', function() {
  before(async function() {
    this.impl = await ProxyTestImpl.new()
  })

  it('must initialize', async function() {
    await this.impl.init()
  })

  it('must revert when attempt to initialize again', async function() {
    await expectRevert(this.impl.init(), 'already inited')
  })
})
