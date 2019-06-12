const fs = require('fs')

const SafeMath = artifacts.require(
  'openzeppelin-solidity/contracts/math/SafeMath.sol'
)

const ChildChain = artifacts.require('ChildChain')
const ChildERC20 = artifacts.require('ChildERC20')

module.exports = async function(deployer, network, accounts) {
  deployer.then(async() => {
    await deployer.deploy(SafeMath)
    await deployer.link(SafeMath, [ChildChain])
    await deployer.deploy(ChildChain)
  })
}
