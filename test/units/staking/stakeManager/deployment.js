import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deployer from '../../../helpers/deployer.js'
import { generateFirstWallets, mnemonics } from '../../../helpers/wallets.js'

chai.use(chaiAsPromised).should()

const wallets = generateFirstWallets(mnemonics, 10)
const walletAmounts = {
  [wallets[0].getAddressString()]: {
    initialBalance: web3.utils.toWei('1200')
  },
  [wallets[1].getAddressString()]: {
    amount: web3.utils.toWei('200'),
    stakeAmount: web3.utils.toWei('200'),
    initialBalance: web3.utils.toWei('1200')
  },
  [wallets[2].getAddressString()]: {
    amount: web3.utils.toWei('250'),
    stakeAmount: web3.utils.toWei('150'),
    restakeAmonut: web3.utils.toWei('100'),
    initialBalance: web3.utils.toWei('805')
  },
  [wallets[3].getAddressString()]: {
    amount: web3.utils.toWei('300'),
    stakeAmount: web3.utils.toWei('300'),
    initialBalance: web3.utils.toWei('850')
  },
  [wallets[4].getAddressString()]: {
    initialBalance: web3.utils.toWei('800')
  }
}

module.exports = {
  wallets,
  walletAmounts,
  async freshDeploy() {
    let contracts = await deployer.deployStakeManager(wallets)
    this.stakeToken = contracts.stakeToken
    this.stakeManager = contracts.stakeManager
    this.rootChainOwner = contracts.rootChainOwner
    
    // dummy registry address
    await this.stakeManager.updateCheckPointBlockInterval(1)
    // transfer tokens to other accounts
    for (const walletAddr in walletAmounts) {
      await this.stakeToken.mint(
        walletAddr,
        walletAmounts[walletAddr].initialBalance
      )
    }
    await this.stakeToken.mint(
      wallets[9].getAddressString(),
      web3.utils.toWei('90000')
    )
    // rewards transfer
    await this.stakeToken.transfer(this.stakeManager.address, web3.utils.toWei('90000'), {
      from: wallets[9].getAddressString()
    })
  }
}
