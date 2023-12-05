const utils = require('./utils')
const contractAddresses = require('../contractAddresses.json')

const DepositManager = artifacts.require('DepositManager')
const DepositManagerProxy = artifacts.require('DepositManagerProxy')

const TestToken = artifacts.require('TestToken')
const POLTokenMock = artifacts.require('POLTokenMock')
const PolygonMigrationTest = artifacts.require('PolygonMigrationTest')
const Governance = artifacts.require('Governance')
const Registry = artifacts.require('Registry')

async function deployPOLToken(governance, mintAmount) {
  const registry = await Registry.at(contractAddresses.root.Registry)

  // Deploy POLToken.
  const polToken = await POLTokenMock.new('Polygon Ecosystem Token', 'POL')
  console.log('New POLToken deployed at', polToken.address)

  // Deploy PolygonMigration.
  const polygonMigrationTest = await PolygonMigrationTest.new()
  console.log('New PolygonMigration deployed at', polygonMigrationTest.address)

  // Map contracts in governance.
  let result = await utils.updateContractMap(governance, registry, 'pol', polToken.address)
  console.log('POLToken mapped in Governance:', result.tx)

  result = await utils.updateContractMap(governance, registry, 'polygonMigration', polygonMigrationTest.address)
  console.log('PolygonMigration mapped in Governance:', result.tx)

  result = await utils.updateContractMap(governance, registry, 'matic', contractAddresses.root.tokens.MaticToken)
  console.log('MaticToken mapped in Governance:', result.tx)

  // Set contract addresses in PolygonMigration.
  result = await polygonMigrationTest.setTokenAddresses(contractAddresses.root.tokens.MaticToken, polToken.address)
  console.log('PolygonMigration contract addresses (MATIC and POL) set:', result.tx)

  // Mint POL to PolygonMigration.
  result = await polToken.mint(polygonMigrationTest.address, mintAmount)
  console.log('POLToken minted to PolygonMigration:', result.tx)

  return {
    polToken: polToken,
    polygonMigration: polygonMigrationTest
  }
}

async function deployNewDepositManager(depositManagerProxy) {
  const newDepositManager = await DepositManager.new()
  console.log('New DepositManager deployed at', newDepositManager.address)

  const result = await depositManagerProxy.updateImplementation(newDepositManager.address)
  console.log('Update DepositManagerProxy implementation:', result.tx)

  const implementation = await depositManagerProxy.implementation()
  console.log('New implementation:', implementation)
  return newDepositManager
}

async function migrateMatic(governance, depositManager, mintAmount) {
  // Mint MATIC to DepositManager.
  const maticToken = await TestToken.at(contractAddresses.root.tokens.MaticToken)
  let result = await maticToken.mint(depositManager.address, mintAmount)
  console.log('MaticToken minted to DepositManager:', result.tx)

  // Migrate MATIC.
  /*
  // TODO: Understand why this call reverts.
  result = await governance.update(
    depositManager.address,
    depositManager.contract.methods.migrateMatic(mintAmount).encodeABI()
  )
  console.log('Migrate MATIC tokens to POL tokens:', result.tx)
  */
}

function assertBigNumberEquality(num1, num2) {
  if (!ethUtils.BN.isBN(num1)) num1 = web3.utils.toBN(num1.toString())
  if (!ethUtils.BN.isBN(num2)) num2 = web3.utils.toBN(num2.toString())
  assert(
    num1.eq(num2),
    `expected ${num1.toString(10)} and ${num2.toString(10)} to be equal`
  )
}

module.exports = async function(deployer, _, _) {
  deployer.then(async() => {
    const oneEther = web3.utils.toBN('10').pow(web3.utils.toBN('18'))

    // Deploy contracts.
    console.log('> Deploying POL token contracts...')
    const governance = await Governance.at(contractAddresses.root.GovernanceProxy)
    const polTokenAmountInMigrationContract = oneEther.mul(web3.utils.toBN('1000000000000000000')).toString()
    const { polToken, polygonMigration } = await deployPOLToken(governance, polTokenAmountInMigrationContract)

    console.log('\n> Updating DepositManager...')
    const depositManagerProxy = await DepositManagerProxy.at(contractAddresses.root.DepositManagerProxy)
    const newDepositManager = await deployNewDepositManager(depositManagerProxy)

    // Migrate MATIC.
    console.log('\n> Migrating MATIC to POL...')
    const maticAmountToMintAndMigrateInDepositManager = oneEther.mul(web3.utils.toBN('1000000000')).toString() // 100 ethers
    await migrateMatic(governance, newDepositManager, maticAmountToMintAndMigrateInDepositManager)

    const newDepositManagerPOLBalance = await polToken.contract.methods.balanceOf(newDepositManager.address).call()
    assertBigNumberEquality(newDepositManagerPOLBalance, maticAmountToMintAndMigrateInDepositManager)

    // Update contract addresses.
    contractAddresses.root.NewDepositManager = newDepositManager.address
    contractAddresses.root.PolToken = polToken.address
    contractAddresses.root.PolygonMigration = polygonMigration.address
    utils.writeContractAddresses(contractAddresses)
    console.log('\n> Contract addresses updated!')
  })
}
