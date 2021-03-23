import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deployer from '../../helpers/deployer.js'
import { generateFirstWallets, mnemonics } from '../../helpers/wallets.js'
import { BN } from '@openzeppelin/test-helpers'

chai.use(chaiAsPromised).should()

export const wallets = generateFirstWallets(mnemonics, 10)
export const walletAmounts = {
  [wallets[0].getAddressString()]: {
    amount: web3.utils.toWei('200'),
    stakeAmount: web3.utils.toWei('200'),
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

export async function freshDeploy() {
  let contracts = await deployer.deployStakeManager(wallets)
  this.stakeToken = contracts.stakeToken
  this.stakeManager = contracts.stakeManager
  this.nftContract = contracts.stakingNFT
  this.rootChainOwner = contracts.rootChainOwner
  this.registry = contracts.registry
  this.governance = contracts.governance
  this.validatorShare = deployer.validatorShare
  this.slashingManager = contracts.slashingManager

  await this.stakeManager.updateCheckpointReward(web3.utils.toWei('10000'))
  await this.stakeManager.updateCheckPointBlockInterval(1)

  for (const walletAddr in walletAmounts) {
    await this.stakeToken.mint(
      walletAddr,
      walletAmounts[walletAddr].initialBalance
    )
  }

  await this.stakeToken.mint(this.stakeManager.address, web3.utils.toWei('10000000'))

  this.defaultHeimdallFee = new BN(web3.utils.toWei('1'))
}

export async function approveAndStake({ wallet, stakeAmount, approveAmount, acceptDelegation = false, heimdallFee, noMinting = false, signer }) {
  const fee = heimdallFee || this.defaultHeimdallFee

  const mintAmount = new BN(approveAmount || stakeAmount).add(new BN(fee))

  if (noMinting) {
    // check if allowance covers fee
    const balance = await this.stakeToken.balanceOf(wallet.getAddressString())
    if (balance.lt(mintAmount)) {
      // mint more
      await this.stakeToken.mint(wallet.getAddressString(), mintAmount.sub(balance))
    }
  } else {
    await this.stakeToken.mint(wallet.getAddressString(), mintAmount)
  }

  await this.stakeToken.approve(this.stakeManager.address, new BN(mintAmount), {
    from: wallet.getAddressString()
  })

  await this.stakeManager.stakeFor(wallet.getAddressString(), stakeAmount, fee, acceptDelegation, signer || wallet.getPublicKeyString(), {
    from: wallet.getAddressString()
  })
}
