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

contract('AvlTree', async function(accounts) {
  let avlTree

  beforeEach(async function() {
    await linkLibs()
    avlTree = await AvlTree.new()
  })

  // generates random int between start and end
  function getRandInt(start, end) {
    return Math.floor(Math.random() * (end - start) + start)
  }

  it('should initialize properly', async function() {
    // root should be NULL/0
    let root = await avlTree.getRoot()
    root.should.be.bignumber.equal(0)
  })

  it('should try to insert from non-owner and fail ', async function() {
    try {
      await avlTree.insert(145, { from: accounts[1] })
    } catch (error) {
      const invalidOpcode = error.message.search('revert') >= 0
      assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
    }
  })

  it('should try to delete node from non-owner and fail', async function() {
    try {
      await avlTree.deleteNode(145, { from: accounts[1] })
    } catch (error) {
      const invalidOpcode = error.message.search('revert') >= 0
      assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
    }
  })

  it('should delete node', async function() {
    await avlTree.insert(140)
    await avlTree.deleteNode(140, { from: accounts[0] })
  })

  it('should set root correct and balanced', async function() {
    await avlTree.insert(14)
    await avlTree.insert(17)
    await avlTree.insert(11)
    await avlTree.insert(7)
    await avlTree.insert(53)
    await avlTree.insert(4)

    let root = await avlTree.getRoot()
    root.should.be.bignumber.equal(14)
  })

  it('should insert 100 node randomly and get max back correctly', async function() {
    // let max = -1
    let min = 99999999999
    let p = []
    for (let i = 0; i < 100; i++) {
      const value = getRandInt(55, 99999999999)
      if (value < min) min = value
      p.push(await avlTree.insert(value))
    }

    await Promise.all(p)
    let treeMin = await avlTree.getMin()
    treeMin.should.be.bignumber.equal(min)
  })

  it('should insert one node succesfully', async function() {
    await avlTree.insert(84630396498)
  })
})
