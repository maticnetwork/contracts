import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import utils from 'ethereumjs-util'
import encode from 'ethereumjs-abi'

import deployer from '../helpers/deployer.js'
import { DummyERC20 } from '../helpers/artifacts'

import { assertBigNumbergt, encodeSigs, getSigs } from '../helpers/utils.js'
import { generateFirstWallets, mnemonics } from '../helpers/wallets.js'

chai.use(chaiAsPromised).should()

contract('SlashingManager', async function(accounts) {
  let stakeManager, wallets, stakeToken, SlashingManager

  before(async function() {
    wallets = generateFirstWallets(mnemonics, 10)
  })

  beforeEach(async function() {
    const contracts = await deployer.freshDeploy({ stakeManager: true })
    // setToken
    stakeManager = contracts.stakeManager
    stakeToken = await DummyERC20.new('Stake Token', 'STAKE')
    await stakeManager.setToken(stakeToken.address)

    await stakeManager.updateValidatorThreshold(3)
    await stakeManager.changeRootChain(wallets[0].getAddressString())
    SlashingManager = contracts.SlashingManager

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

  it('should slash validator', async function() {
    const user = wallets[2].getAddressString()
    const amount = web3.utils.toWei('250')
    await stakeToken.approve(stakeManager.address, amount, {
      from: user
    })
    await stakeManager.stake(amount, user, false, {
      from: user
    })
    const beforeStake = await stakeManager.totalStakedFor(user)

    let data1 = buildCheckpointPaylod(
      wallets[2].getAddressString(),
      1,
      2,
      wallets[2]
    )

    let data2 = buildCheckpointPaylod(
      wallets[2].getAddressString(),
      1,
      4,
      wallets[2]
    )

    // bytes memory vote1, bytes memory vote2, bytes memory sig1, bytes memory sig2
    let result = await SlashingManager.doubleSign(
      data1.vote,
      data2.vote,
      data1.sig,
      data2.sig
    )
    const afterStake = await stakeManager.totalStakedFor(user)
    assertBigNumbergt(beforeStake, afterStake)
  })

  it('should not slash validator', async function() {
    const user = wallets[2].getAddressString()
    const amount = web3.utils.toWei('250')
    await stakeToken.approve(stakeManager.address, amount, {
      from: user
    })

    await stakeManager.stake(amount, user, false, {
      from: user
    })

    let data1 = buildCheckpointPaylod(
      wallets[2].getAddressString(),
      1,
      2,
      wallets[2]
    )

    let data2 = buildCheckpointPaylod(
      wallets[2].getAddressString(),
      1,
      2,
      wallets[2]
    )

    // bytes memory vote1, bytes memory vote2, bytes memory sig1, bytes memory sig2
    try {
      await SlashingManager.doubleSign(
        data1.vote,
        data2.vote,
        data1.sig,
        data2.sig
      )
    } catch (error) {
      const invalidOpcode = error.message.search('revert same vote') >= 0
      assert(invalidOpcode, "Expected revert, got '" + error + "' instead")
    }
  })
})

function buildCheckpointPaylod(proposer, start, end, wallet) {
  let root = utils.keccak256(encode(start, end)) // dummy root
  // [proposer, start, end, root]
  const extraData = utils.bufferToHex(
    utils.rlp.encode([proposer, start, end, root])
  )
  const vote = utils.bufferToHex(
    // [chain, roundType, height, round, keccak256(bytes20(sha256(extraData)))]
    utils.rlp.encode([
      'test-chain-E5igIA',
      'vote',
      1,
      2,
      utils.bufferToHex(utils.sha256(extraData)).slice(0, 42)
    ])
  )

  const sig = utils.bufferToHex(
    encodeSigs(getSigs([wallet], utils.keccak256(vote)))
  )
  return { vote, sig }
}
