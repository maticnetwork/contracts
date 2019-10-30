const config = require(`./config/${process.env.NODE_ENV}.json`)
const crypto = require('crypto')

const ChildERC721Mintable = require('../build/contracts/ChildERC721Mintable.json')
const ERC721PlasmaMetadataMintable = require('../build/contracts/ERC721PlasmaMetadataMintable.json')
const ChildChain = require('../build/contracts/ChildChain.json')
const Registry = require('../build/contracts/Registry.json')
const ERC721Predicate = require('../build/contracts/ERC721Predicate.json')

const Web3 = require('web3')
const HDWalletProvider = require('truffle-hdwallet-provider')
const MNEMONIC = process.env.MNEMONIC
const web3 = new Web3(new HDWalletProvider(MNEMONIC, `https://testnet2.matic.network`, 0, 2))
const childWeb3 = new Web3(new HDWalletProvider(MNEMONIC, `https://testnet2.matic.network`, 0, 2))
// const childWeb3 = new Web3(new HDWalletProvider('0x70e8c03346745867a67798fd3784e4bf1765d82b08b54cd4ff58a1ca9e87518e', `http://localhost:8545`, 0, 2))

async function execute() {
  const accounts = await web3.eth.getAccounts()
  console.log(accounts)
  console.log(await childWeb3.eth.getAccounts())
  const childAccounts = await childWeb3.eth.getAccounts()
  const root721 = new web3.eth.Contract(ERC721PlasmaMetadataMintable.abi, config.root.tokens.E721)
  const registry = new web3.eth.Contract(Registry.abi, config.root.Registry)
  const predicate = new web3.eth.Contract(ERC721Predicate.abi, config.root.ERC721Predicate)

  const childERC721 = new childWeb3.eth.Contract(ChildERC721Mintable.abi, config.child.tokens.E721)
  const childChain = new childWeb3.eth.Contract(ChildChain.abi, config.child.ChildChain)
  // await root721.methods.AddModerator(predicate.options.address).send({ from: accounts[0], gas: 1000000 })
  await childChain.methods.mapToken(root721.options.address, childERC721.options.address, true).send({ from: childAccounts[0], gas: 1000000 })
  await registry.methods.mapToken(root721.options.address, childERC721.options.address, true).send({ from: accounts[0], gas: 1000000 })

  const tokenId = '0x' + crypto.randomBytes(32).toString('hex')
  const uri = `https://tokens.com/${tokenId}`
  const alice = childAccounts[1]
  await childERC721.methods.mintWithTokenURI(alice, tokenId, uri).send({ from: childAccounts[0], gas: 3000000 })
  console.log(await childERC721.methods.withdraw(tokenId).send({ from: alice, gas: 1000000 }))
}

execute().then(() => console.log('done'))
