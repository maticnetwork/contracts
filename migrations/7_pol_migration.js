const utils = require('./utils')
const contractAddresses = require('../contractAddresses.json')

const DepositManager = artifacts.require('DepositManager')
const DepositManagerProxy = artifacts.require('DepositManagerProxy')

const TestToken = artifacts.require('TestToken')
const POLTokenMock = artifacts.require('POLTokenMock')
const PolygonMigrationTest = artifacts.require('PolygonMigrationTest')
const Governance = artifacts.require('Governance')
const Registry = artifacts.require('Registry')

async function deployPOLToken(sender, governance, mintAmount) {
  const registry = await Registry.at(contractAddresses.root.Registry)

  // Deploy POLToken.
  const polToken = await POLTokenMock.new('Polygon Ecosystem Token', 'POL')
  console.log('New POLToken deployed at', polToken.address)

  // Deploy PolygonMigration.
  const polygonMigrationTest = await PolygonMigrationTest.new()
  console.log('New PolygonMigration deployed at', polygonMigrationTest.address)

  // Map contracts in governance.
  // Note: also add an entry for 'matic'.
  let result = await utils.updateContractMap(governance, registry, 'pol', polToken.address)
  console.log('POLToken mapped in Governance:', result.tx)

  result = await utils.updateContractMap(governance, registry, 'polygonMigration', polygonMigrationTest.address)
  console.log('PolygonMigration mapped in Governance:', result.tx)

  result = await utils.updateContractMap(governance, registry, 'matic', contractAddresses.root.tokens.MaticToken)
  console.log('MaticToken mapped in Governance:', result.tx)

  // Set contract addresses in PolygonMigration.
  result = await polygonMigrationTest.contract.methods.setTokenAddresses(contractAddresses.root.tokens.MaticToken, polToken.address).send({ from: sender })
  console.log('PolygonMigration contract addresses (MATIC and POL) set:', result.tx)

  // Mint POL to PolygonMigration.
  result = await polToken.contract.methods.mint(polygonMigrationTest.address, mintAmount).send({ from: sender })
  console.log('POLToken minted to PolygonMigration:', result.tx)

  return {
    polToken: polToken,
    polygonMigration: polygonMigrationTest
  }
}

async function deployNewDepositManager() {
  const newDepositManager = await DepositManager.new()
  console.log('New DepositManager deployed at', newDepositManager.address)

  const depositManagerProxy = await DepositManagerProxy.at(contractAddresses.root.DepositManagerProxy)
  const result = await depositManagerProxy.updateImplementation(newDepositManager.address)
  console.log('Update DepositManagerProxy implementation:', result.tx)

  const implementation = await depositManagerProxy.implementation()
  console.log('New implementation:', implementation)
  return newDepositManager
}

async function migrateMatic(sender, governance, depositManager, mintAmount) {
  // Mint MATIC to DepositManager.
  const maticToken = await TestToken.at(contractAddresses.root.tokens.MaticToken)
  let result = await maticToken.methods.mint(depositManager.address, mintAmount).send({ from: sender })
  console.log('MaticToken minted to DepositManager:', result.tx)

  // Migrate MATIC.
  result = await governance.update(
    depositManager.address,
    depositManager.contract.methods.migrateMatic(mintAmount).encodeABI()
  )
}

module.exports = async function(deployer, network, accounts) {
  deployer.then(async() => {
    const sender = accounts[0]
    const governance = await Governance.at(contractAddresses.root.GovernanceProxy)

    // Deploy contracts.
    const mintAmount = web3.utils.toBN('10').pow(web3.utils.toBN('18')).toString()
    const { polToken, polygonMigration } = await deployPOLToken(sender, governance, mintAmount)
    const newDepositManager = await deployNewDepositManager()
    await migrateMatic(sender, governance, newDepositManager, mintAmount)

    // Check that MATIC balance has been converted to POL
    const newDepositManagerPOLBalance = await polToken.contract.methods.balanceOf(newDepositManager.address).call()
    utils.assertBigNumberEquality(newDepositManagerPOLBalance, mintAmount)

    // Update contract addresses.
    contractAddresses.root.DepositManager = newDepositManager.address
    contractAddresses.root.PolToken = polToken.address
    contractAddresses.root.PolygonMigration = polygonMigration.address
    utils.writeContractAddresses(contractAddresses)
  })
}
