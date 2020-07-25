const contractAddresses = require('../contractAddresses.json')

const Registry = artifacts.require('Registry')
const Governance = artifacts.require('Governance')
const ChildERC20Proxified = artifacts.require('ChildERC20Proxified')
const ChildTokenProxy = artifacts.require('ChildTokenProxy')
const ChildChain = artifacts.require('ChildChain')

const toBN = web3.utils.toBN
console.log(contractAddresses)

function delay(s) {
  return new Promise(resolve => setTimeout(resolve, s * 1000));
}

function getRegistry() {
  return Registry.at(contractAddresses.root.Registry)
}

function getGovernance() {
  return Governance.at(contractAddresses.root.GovernanceProxy)
}

function getChildChain() {
  return ChildChain.at(contractAddresses.child.ChildChain)
}

async function deployChildERC20AndMap({token, name, symbol, decimals, doMapping}) {
  console.log("New child token with root token:", token)
  console.log("    name:       ", name)
  console.log("    symbol:     ", symbol)
  console.log("    decimals:   ", decimals)
  console.log("    doMapping:  ", doMapping)

  const childChain = await getChildChain()
  console.log("Currently mapped token for root token:", await childChain.tokens(token))

  const childERC20Proxified = await ChildERC20Proxified.new()
  console.log("Child ERC20 implementation address:", childERC20Proxified.address)
  const childTokenProxy = await ChildTokenProxy.new(childERC20Proxified.address)
  console.log("Child ERC20 proxy address:", childTokenProxy.address)

  const childToken = await ChildERC20Proxified.at(childTokenProxy.address)
  console.log("Initializing child token with properties")
  await childToken.initialize(
    token,
    name,
    symbol,
    decimals
  )

  console.log("Token child address:", childToken.address)
  console.log("Token child implmentation address (should not be used):", await childTokenProxy.implementation())
  console.log("Token root address:", await childToken.token())
  console.log("Token name:", await childToken.name())
  console.log("Token symbol:", await childToken.symbol())
  const d = await childToken.decimals()
  console.log("Token decimals:", d.toString())

  // set child chain address
  console.log("Setting child chain")
  await childToken.changeChildChain(contractAddresses.child.ChildChain)
  console.log("Token child chain address:", await childToken.childChain())
  console.log("Token parent address:", await childToken.parent())
  console.log("Token owner address:", await childToken.owner())

  // mapping token on child
  if (doMapping) {
    await childChain.mapToken(token, childToken.address, false)
    console.log("Updated mapped token for root token (should be child token):", await childChain.tokens(token))
  }

  console.log("====")
  console.log("Child ERC20 token address:", childToken.address)
  console.log("====")
}

async function mapTokenOnMainchain(root, child, isErc721) {
  console.log("Mapping:")
  console.log("    root:    ", root)
  console.log("    child:   ", child)
  console.log("    isErc721:", isErc721)

  const registry = await getRegistry()
  const governance = await getGovernance()

  console.log("Root to child token on registry before update:", await registry.rootToChildToken(root))

  // update registry using governance for token mapping
  const receipt = await governance.update(
    contractAddresses.root.Registry,
    registry.contract.methods.mapToken(root, child, isErc721).encodeABI()
  )
  console.log("Mapping token on root chain with tx hash:", receipt.tx)

  console.log("Root to child token on registry after update:", await registry.rootToChildToken(root))
}

module.exports = async function (callback) {
  // args starts with index 6, example: first arg == process.args[6]
  console.log(process.argv)
  try {
    // -- network <child network> <token> <name> <symbol> <decimals> <true/false for mapping>
    // await deployChildERC20AndMap({
    //   token: process.argv[6],
    //   name: process.argv[7],
    //   symbol: process.argv[8],
    //   decimals: parseInt(process.argv[9], 10),
    //   doMapping: process.argv[10] === 'true'
    // })

    // -- network <mainchain network> <root> <child> <true/false for erc721>
    // await mapTokenOnMainchain(
    //   process.argv[6], // root token
    //   process.argv[7], // child token
    //   process.argv[8] === 'true' // if it's ERC721 or not
    // )
  } catch (e) {
    // truffle exec <script> doesn't throw errors, so handling it in a verbose manner here
    console.log(e)
  }
  callback()
}