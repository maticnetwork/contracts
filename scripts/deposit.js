const contractAddresses = require('../contractAddresses.json')

const ChildERC20Proxified = artifacts.require('ChildERC20Proxified')
const ChildERC721Proxified = artifacts.require('ChildERC721Proxified')
const DepositManager = artifacts.require('DepositManager')

const toBN = web3.utils.toBN

console.log("Contract addresses: ", contractAddresses)

function getDepositManager() {
  return DepositManager.at(contractAddresses.root.DepositManagerProxy)
}

async function checkDepositedERC20Balance({ addr, token }) {
  const childToken = await ChildERC20Proxified.at(token)
  const b = await childToken.balanceOf(addr)
  console.log("Balance for given address:", b.toString())
}

async function checkDepositedERC721Balance({ addr, token, tokenID }) {
  const childToken = await ChildERC721Proxified.at(token)
  const owner = await childToken.ownerOf(tokenID)
  console.log("Owner for given NFT:", owner, ", should be:", addr)
}

async function depositERC20({ addr, rootToken, amount }) {
  console.log("Deposit ERC20:")
  console.log("   Token:  ", rootToken)
  console.log("   Amount: ", amount)

  const childToken = await ChildERC20Proxified.at(rootToken)
  const b = await childToken.balanceOf(addr)
  console.log("Balance for current address:", b.toString())

  const depositMangaer = await getDepositManager()
  const approveReceipt = await childToken.approve(depositMangaer.address, amount)
  console.log("Approved tokens transfer with tx:", approveReceipt.tx)

  const depositReceipt = await depositMangaer.depositERC20(rootToken, amount)
  console.log("Deposit tokens with tx:", depositReceipt.tx)
}

async function depositERC721({ addr, rootToken, tokenID }) {
  console.log("Deposit ERC721:")
  console.log("   Token:   ", rootToken)
  console.log("     NFT:   ", tokenID)

  const childToken = await ChildERC721Proxified.at(rootToken)
  const owner = await childToken.ownerOf(tokenID)
  console.log("Owner of current tokenID:", owner, ", should be:", addr)

  const depositMangaer = await getDepositManager()
  const approveReceipt = await childToken.approve(depositMangaer.address, tokenID)
  console.log("Approved NFT transfer with tx:", approveReceipt.tx)

  const depositReceipt = await depositMangaer.depositERC721(rootToken, tokenID)
  console.log("Deposit NFT with tx:", depositReceipt.tx)
}

module.exports = async function (callback) {
  // args starts with index 6, example: first arg == process.args[6]
  console.log(process.argv)
  try {
    const accounts = await web3.eth.getAccounts()
    console.log("Current configured address to make transactions:", accounts[0])

    // -- network <main network> <root token> <amount>
    // await depositERC20({
    //   addr: accounts[0], 
    //   rootToken: process.argv[6],
    //   amount: process.argv[7],
    // })

    // -- network <main network> <root token> <amount>
    // await depositERC721({
    //   addr: accounts[0], 
    //   rootToken: process.argv[6], // root token
    //   tokenID: process.argv[7], // nft id
    // })

    // -- network <matic network> <child token>
    // await checkDepositedERC20Balance({
    //   addr: accounts[0], 
    //   token: process.argv[6], // child token
    // })

    // -- network <matic network> <child token> <nft id>
    // await checkDepositedERC721Balance({
    //   addr: accounts[0], 
    //   token: process.argv[6], // child token
    //   tokenID: process.argv[7], // nft id
    // })
  } catch (e) {
    // truffle exec <script> doesn't throw errors, so handling it in a verbose manner here
    console.log(e)
  }
  callback()
}