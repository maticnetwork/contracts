import { task } from 'hardhat/config'
import { ZeroAddress } from '../lib'
import { TASKS } from './task-names'
import Web3 from 'web3'

const MATIC_TOKEN_ADDRESS = '0x0000000000000000000000000000000000001010'

task(TASKS.DEPLOY_CHILD, 'run full deployment on a child chain')
  .addOptionalParam('url', 'URL to connect to Child network', 'http://localhost:8545')
  .addParam('matic', 'Matic token address on the root network')
  .addParam('weth', 'WETH token address on the root network')
  .setAction(async function({ matic, weth, url }, { artifacts, network }) {
    const childProvider = new Web3.providers.HttpProvider(url)
    const web3 = new Web3(childProvider)
    const accounts = await web3.eth.getAccounts()
    const options = { from: accounts[0] || undefined, gas: 7500000 }

    const deploy = async(artifact, ...args) => {
      let instance

      if (args.length === 0) {
        instance = await artifact.new(options)
      } else {
        instance = await artifact.new(...args, options)
      }
      return instance
    }

    console.log(`Deploying Child contracts at ${url}...`)

    const ChildChain = artifacts.require('ChildChain')
    ChildChain.setProvider(childProvider)

    const MRC20 = artifacts.require('MRC20')
    MRC20.setProvider(childProvider)

    const childChain = await deploy(ChildChain)

    await childChain.addToken(
      accounts[0], // owner
      weth,
      'ETH on Matic', // name
      'ETH', // symbol
      18, // decimals
      false, // isERC721
      options
    )

    const maticToken = await MRC20.at(MATIC_TOKEN_ADDRESS)
    const maticOwner = await maticToken.owner()
    if (maticOwner === ZeroAddress) {
      // matic contract at 0x1010 can only be initialized once, after the bor image starts to run
      await maticToken.initialize(childChain.address, matic, options)
    }
    await childChain.mapToken(matic, MATIC_TOKEN_ADDRESS, false, options)

    return {
      childChain: childChain.address,
      matic: MATIC_TOKEN_ADDRESS
    }
  })
