import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import deployer from '../helpers/deployer.js'
// import { ValidatorContract } from '../helpers/artifacts'
import { DummyERC20, ValidatorContract } from '../helpers/artifacts'

import {
  assertBigNumberEquality,
  assertBigNumbergt,
  buildSubmitHeaderBlockPaylod,
  ZeroAddress
} from '../helpers/utils.js'
import { mineOneBlock, increaseBlockTime } from '../helpers/chain.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'
import logDecoder from '../helpers/log-decoder.js'

chai.use(chaiAsPromised).should()

contract('DelegationManager', async function(accounts) {
  let stakeManager, delegationManager, wallets, stakeToken, slashing

  before(async function() {
    wallets = generateFirstWallets(mnemonics, 10)
  })

  beforeEach(async function() {
    const contracts = await deployer.freshDeploy()
    // setToken
    stakeManager = contracts.stakeManager
    stakeToken = await DummyERC20.new('Stake Token', 'STAKE')
    await stakeManager.setToken(stakeToken.address)

    await stakeManager.updateValidatorThreshold(3)
    await stakeManager.changeRootChain(wallets[0].getAddressString())
    slashing = contracts.slashing

    // transfer tokens to other accounts
    await stakeToken.mint(
      wallets[0].getAddressString(),
      web3.utils.toWei('1200')
    )
    await stakeToken.mint(
      wallets[1].getAddressString(),
      web3.utils.toWei('800')
    )
    await stakeToken.mint(
      wallets[2].getAddressString(),
      web3.utils.toWei('1200')
    )

  })

  it('stake', async function() {
    const user = wallets[2].getAddressString()
    const amount = web3.utils.toWei('250')
    await stakeToken.approve(stakeManager.address, amount, {
      from: user
    })
    await stakeManager.stake(amount, user, false, {
      from: user
    })
    let data1 = buildCheckpointPaylod(wallets[2].getAddressString(),
    1, 2, wallets[2])

    let data2 = buildCheckpointPaylod(wallets[2].getAddressString(),
    1, 2, wallets[2])
    console.log(data1, data2)
    // bytes memory vote1, bytes memory vote2, bytes memory sig1, bytes memory sig2
    let result = await slashing.doubleSign(data1.vote, data2.vote, data1.sig, data2.sig)

    )
  })
})

function buildCheckpointPaylod(proposer, start, end, wallet) {
  let root = utils.keccak256(encode(start, end)) // dummy root
  // [proposer, start, end, root]
  const extraData = utils.bufferToHex(utils.rlp.encode([proposer, start, end, root]))
  const vote = utils.bufferToHex(
    // [chain, roundType, height, round, keccak256(bytes20(sha256(extraData)))]
    utils.rlp.encode([
      'test-chain-E5igIA', 'vote', 1, 0, 2,
      utils.bufferToHex(utils.sha256(extraData)).slice(0, 42)
    ])
  )


  const sig = utils.bufferToHex(
    encodeSigs(getSigs(wallet, utils.keccak256(vote)))
  )
  return {vote, sig}
}
