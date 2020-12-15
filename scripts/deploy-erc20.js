const contractAddresses = require('../contractAddresses.json')

const Registry = artifacts.require('Registry')
const Governance = artifacts.require('Governance')
const ChildERC20Proxified = artifacts.require('ChildERC20Proxified')
const ChildERC721Proxified = artifacts.require('ChildERC721Proxified')
const ChildTokenProxy = artifacts.require('ChildTokenProxy')
const ChildChain = artifacts.require('ChildChain')
const TestToken = artifacts.require('TestToken')
const RootERC721 = artifacts.require('RootERC721')

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

async function checkChildERC20(addr) {
  const childToken = await ChildERC20Proxified.at(addr)
  console.log("Token child address:", childToken.address)
  console.log("Token root address:", await childToken.token())
  console.log("Token name:", await childToken.name())
  console.log("Token symbol:", await childToken.symbol())
  const d = await childToken.decimals()
  console.log("Token decimals:", d.toString())

  const c = await childToken.CHAINID()
  console.log("Token chainID:", c.toString())

  console.log("Token child chain address:", await childToken.childChain())
  console.log("Token parent address:", await childToken.parent())
  console.log("Token owner address:", await childToken.owner())
}

async function checkChildERC721(addr) {
  const childToken = await ChildERC721Proxified.at(addr)
  console.log("Token child address:", childToken.address)
  console.log("Token root address:", await childToken.token())
  console.log("Token name:", await childToken.name())
  console.log("Token symbol:", await childToken.symbol())

  const c = await childToken.CHAINID()
  console.log("Token chainID:", c.toString())

  console.log("Token child chain address:", await childToken.childChain())
  console.log("Token parent address:", await childToken.parent())
  console.log("Token owner address:", await childToken.owner())
}

async function deployTestERC20OnMainchain(addr) {
  const testToken = await TestToken.new('TestToken', 'TST')
  // const testToken = await TestToken.at('<test token address if already deployed>')
  console.log("Root test token address:", testToken.address)
  const b = await testToken.balanceOf(addr)
  console.log("Balance for current address:", b.toString())
}

async function deployTestERC721OnMainchain(addr) {
  const testToken = await RootERC721.new('RootERC721', 'T721')
  // const testToken = await RootERC721.at('<test token address if already deployed>')
  console.log("Root test token address:", testToken.address)
  const receipt = await testToken.mint(1)
  console.log("Mint token 1 for tx hash:", receipt.tx)
  const owner = await testToken.ownerOf(1)
  console.log("Owner of token 1:", owner)
}

async function deployChildERC20AndMap({token, name, symbol, decimals, doMapping}) {
  console.log("New child erc20 token with root token:", token)
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

  const c = await childToken.CHAINID()
  console.log("Token chainID:", c.toString())

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

async function deployChildERC721AndMap({token, name, symbol, doMapping}) {
  console.log("New child erc721 token with root token:", token)
  console.log("    name:       ", name)
  console.log("    symbol:     ", symbol)
  console.log("    doMapping:  ", doMapping)

  const childChain = await getChildChain()
  console.log("Currently mapped token for root token:", await childChain.tokens(token))

  const childERC721Proxified = await ChildERC721Proxified.new()
  console.log("Child ERC721 implementation address:", childERC721Proxified.address)
  const childTokenProxy = await ChildTokenProxy.new(childERC721Proxified.address)
  console.log("Child ERC721 proxy address:", childTokenProxy.address)

  const childToken = await ChildERC721Proxified.at(childTokenProxy.address)
  console.log("Initializing child token with properties")
  await childToken.initialize(
    token,
    name,
    symbol
  )

  console.log("Token child address:", childToken.address)
  console.log("Token child implmentation address (should not be used):", await childTokenProxy.implementation())
  console.log("Token root address:", await childToken.token())
  console.log("Token name:", await childToken.name())
  console.log("Token symbol:", await childToken.symbol())

  const c = await childToken.CHAINID()
  console.log("Token chainID:", c.toString())

  // set child chain address
  console.log("Setting child chain")
  await childToken.changeChildChain(contractAddresses.child.ChildChain)
  console.log("Token child chain address:", await childToken.childChain())
  console.log("Token parent address:", await childToken.parent())
  console.log("Token owner address:", await childToken.owner())

  // mapping token on child
  if (doMapping) {
    await childChain.mapToken(token, childToken.address, true)
    console.log("Updated mapped token for root token (should be child token):", await childChain.tokens(token))
  }

  console.log("====")
  console.log("Child ERC721 token address:", childToken.address)
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
  console.log("Encoded ABI for governance:", registry.contract.methods.mapToken(root, child, isErc721).encodeABI())

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
    const accounts = await web3.eth.getAccounts()
    console.log("Current configured address to make transactions:", accounts[0])

    // -- network <child network> <child token>
    // await checkChildERC20(process.argv[6])
    // await checkChildERC721(process.argv[6])

    // -- network <main network>
    // await deployTestERC20OnMainchain(accounts[0])
    // await deployTestERC721OnMainchain(accounts[0])

    // -- network <child network> <token> <name> <symbol> <decimals> <true/false for mapping>
    // await deployChildERC20AndMap({
    //   token: process.argv[6],
    //   name: process.argv[7],
    //   symbol: process.argv[8],
    //   decimals: parseInt(process.argv[9], 10),
    //   doMapping: process.argv[10] === 'true'
    // })

    // -- network <child network> <token> <name> <symbol> <true/false for mapping>
    // await deployChildERC721AndMap({
    //   token: process.argv[6],
    //   name: process.argv[7],
    //   symbol: process.argv[8],
    //   doMapping: process.argv[9] === 'true'
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