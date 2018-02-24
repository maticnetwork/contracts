var Migrations = artifacts.require('./Migrations.sol')

let ECVerify = artifacts.require('./lib/ECVerify.sol')
let RLP = artifacts.require('./lib/RLP.sol')
let PatriciaUtils = artifacts.require('./lib/PatriciaUtils.sol')
let SafeMath = artifacts.require('./lib/SafeMath.sol')

module.exports = function(deployer) {
  deployer.deploy(Migrations)
}
