const ethUtils = require('ethereumjs-util')
const utils = require('./utils')
const contractAddresses = require('../contractAddresses.json')

const DepositManager = artifacts.require('DepositManager')
const DepositManagerProxy = artifacts.require('DepositManagerProxy')

const POLTokenMock = artifacts.require('POLTokenMock')
const PolygonMigrationTest = artifacts.require('PolygonMigrationTest')
const Governance = artifacts.require('Governance')
const Registry = artifacts.require('Registry')

async function deployPOLToken(sender) {
  const governance = await Governance.at(contractAddresses.root.GovernanceProxy)
  const registry = await Registry.at(contractAddresses.root.registry)

  // Deploy PolygonMigration.
  const polygonMigrationTest = await PolygonMigrationTest.new()
  console.log('New PolygonMigration deployed at ', polygonMigrationTest.address)

  let result = await utils.updateContractMap(governance, registry, ethUtils.keccak256('polygonMigration'), polygonMigrationTest.address)
  console.log('PolygonMigration added to Governance: ', result.tx)

  // Deploy POLToken.
  const polToken = await POLTokenMock.new('Polygon Ecosystem Token', 'POL')
  console.log('New POLToken deployed at ', polToken.address)

  result = await utils.updateContractMap(governance, registry, ethUtils.keccak256('pol'), polToken.address)
  console.log('POLToken added to Governance: ', result.tx)

  // Link contracts.
  result = await polygonMigrationTest.contract.methods.setTokenAddresses(contractAddresses.root.MaticToken, polToken.address).send({ from: sender })
  console.log('POLToken linked to PolygonMigration: ', result.tx)

  // Mint POL to PolygonMigrationTest.
  const amount = web3.utils.toBN('10').pow(web3.utils.toBN('18'))
  result = await polToken.contract.methods.mint(polygonMigrationTest.address, amount.toString()).send({ from: sender })
  console.log('POLToken minted to PolygonMigration: ', result.tx)

  return {
    polToken: polToken.address,
    polygonMigration: polygonMigrationTest.address
  }
}

async function deployNewDepositManager() {
  const newDepositManager = await DepositManager.new()
  console.log('New DepositManager deployed at ', newDepositManager.address)

  const depositManagerProxy = await DepositManagerProxy.at(contractAddresses.root.DepositManagerProxy)
  const result = await depositManagerProxy.updateImplementation(newDepositManager.address)
  console.log('Update DepositManagerProxy implementation: ', result.tx)

  const implementation = await depositManagerProxy.implementation()
  console.log('New implementation: ', implementation)
  return newDepositManager.address
}

module.exports = async function(deployer, network, accounts) {
  deployer.then(async() => {
    // Deploy contracts.
    const { polTokenAddress, polygonMigrationAddress } = await deployPOLToken(accounts[0])
    const newDepositManagerAddress = await deployNewDepositManager()

    // Update contract addresses.
    contractAddresses.root.DepositManager = newDepositManagerAddress
    contractAddresses.root.PolToken = polTokenAddress
    contractAddresses.root.PolygonMigration = polygonMigrationAddress
    utils.writeContractAddresses(contractAddresses)
  })
}
