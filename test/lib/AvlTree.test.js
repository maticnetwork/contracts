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
    let root = await avlTree.getRoot()
    root.should.be.bignumber.equal(0)

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
    await avlTree.insert(14)
    await avlTree.insert(17)
    await avlTree.insert(11)
    await avlTree.insert(7)
    await avlTree.insert(53)
    await avlTree.insert(4)

    // await promise.all(p)
    let root = await avlTree.getRoot()
    root.should.be.bignumber.equal(14)
    // await avlTree.insert(13)

    // let x = await avlTree.getRoot()
    // console.log(x)
    // await avlTree.getRoot().should.equal()
    // console.log(await avlTree.getRoot())
  })
})
