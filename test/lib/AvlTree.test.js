import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiBigNumber from 'chai-bignumber'

import { linkLibs } from '../helpers/utils'
import { AvlTree } from '../helpers/contracts'

// add chai pluggin
chai
  .use(chaiAsPromised)
  .use(chaiBigNumber(web3.BigNumber))
  .should()

contract('AvlTree', async function() {
  let avlTree

  beforeEach(async function() {
    await linkLibs()
    avlTree = await AvlTree.new()
  })

  it('should initialize properly', async function() {
    // root should be NULL/0
    // assert.equal(new web3.BigNumber(0), out)
    await avlTree.getRoot().should.eventually.equal(new web3.BigNumber(0))

    // await avlTree.insertValue(50)
    // await avlTree.getRoot().should.eventually.equal(50)
    // await avlTree.search(50).should.equal(true)
  })

  it('should set root correct and balanced', async function() {
    let array = [14, 17, 11, 7, 53, 4]
    // let p = Promise[]
    // for(let i = 0;i < array.length; i++) {
    //   await avlTree.insertValue(array[i])
    // }
    await avlTree.insertValue(14)
    await avlTree.insertValue(17)
    await avlTree.insertValue(11)
    await avlTree.insertValue(7)
    await avlTree.insertValue(53)
    await avlTree.insertValue(4)

    // await promise.all(p)
    let x = await avlTree.getRoot()
    console.log(x)
    await avlTree.getRoot().should.eventually.equal(new web3.BigNumber(14))
    await avlTree.insertValue(13)

    await avlTree.getRoot()
    console.log(x)
    // await avlTree.getRoot().should.equal()
    // console.log(await avlTree.getRoot())
  })
})
