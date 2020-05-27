const ethUtils = require('ethereumjs-util')
const bluebird = require('bluebird')

const Registry = artifacts.require('Registry')
const DepositManagerProxy = artifacts.require('DepositManagerProxy')
const StateSender = artifacts.require('StateSender')
const Governance = artifacts.require('Governance')
const GovernanceProxy = artifacts.require('GovernanceProxy')
const WithdrawManagerProxy = artifacts.require('WithdrawManagerProxy')
const StakeManager = artifacts.require('StakeManager')
const ValidatorShare = artifacts.require('ValidatorShare')
const SlashingManager = artifacts.require('SlashingManager')

const StakingNFT = artifacts.require('StakingNFT')
const StakeManagerProxy = artifacts.require('StakeManagerProxy')
const ERC20Predicate = artifacts.require('ERC20Predicate')
const ERC721Predicate = artifacts.require('ERC721Predicate')
const MarketplacePredicate = artifacts.require('MarketplacePredicate')
const TransferWithSigPredicate = artifacts.require('TransferWithSigPredicate')
const MaticWeth = artifacts.require('MaticWETH')
const TestToken = artifacts.require('TestToken')

module.exports = async function(deployer, network) {
  deployer.then(async () => {
    console.log('initializing contract state...')
    await bluebird
      .all([
        TestToken.deployed(),
        Registry.deployed(),
        GovernanceProxy.deployed(),
        DepositManagerProxy.deployed(),
        StateSender.deployed(),
        WithdrawManagerProxy.deployed(),
        StakeManagerProxy.deployed(),
        SlashingManager.deployed(),
        ValidatorShare.deployed(),
        StakingNFT.deployed(),
        MaticWeth.deployed(),
        ERC20Predicate.deployed(),
        ERC721Predicate.deployed(),
        MarketplacePredicate.deployed(),
        TransferWithSigPredicate.deployed()
      ])
      .spread(async function(
        testToken,
        registry,
        governanceProxy,
        depositManagerProxy,
        stateSender,
        withdrawManagerProxy,
        stakeManagerProxy,
        slashingManager,
        validatorShare,
        stakingNFT,
        maticWeth,
        ERC20Predicate,
        ERC721Predicate,
        MarketplacePredicate,
        TransferWithSigPredicate
      ) {
        let governance = await Governance.at(governanceProxy.address)
        await governance.update(
          registry.address,
          registry.contract.methods.updateContractMap(
            ethUtils.bufferToHex(ethUtils.keccak256('depositManager')),
            depositManagerProxy.address
          ).encodeABI()
        )
        await governance.update(
          registry.address,
          registry.contract.methods.updateContractMap(
            ethUtils.bufferToHex(ethUtils.keccak256('withdrawManager')),
            withdrawManagerProxy.address
          ).encodeABI()
        )
        await governance.update(
          registry.address,
          registry.contract.methods.updateContractMap(
            ethUtils.bufferToHex(ethUtils.keccak256('stakeManager')),
            StakeManagerProxy.address
          ).encodeABI()
        )
        await governance.update(
          registry.address,
          registry.contract.methods.updateContractMap(
            ethUtils.bufferToHex(ethUtils.keccak256('validatorShare')),
            validatorShare.address
          ).encodeABI()
        )
        await governance.update(
          registry.address,
          registry.contract.methods.updateContractMap(
            ethUtils.bufferToHex(ethUtils.keccak256('slashingManager')),
            slashingManager.address
          ).encodeABI()
        )
        await governance.update(
          registry.address,
          registry.contract.methods.updateContractMap(
            ethUtils.bufferToHex(ethUtils.keccak256('stateSender')),
            stateSender.address
          ).encodeABI()
        )
        await governance.update(
          registry.address,
          registry.contract.methods.updateContractMap(
            ethUtils.bufferToHex(ethUtils.keccak256('wethToken')),
            maticWeth.address
          ).encodeABI()
        )

        await stakingNFT.transferOwnership(StakeManagerProxy.address)
        await (await StakeManager.at(stakeManagerProxy.address)).setToken(testToken.address)

        // whitelist predicates
        await governance.update(
          registry.address,
          registry.contract.methods.addErc20Predicate(
            ERC20Predicate.address
          ).encodeABI()
        )
        await governance.update(
          registry.address,
          registry.contract.methods.addErc721Predicate(
            ERC721Predicate.address
          ).encodeABI()
        )
        await governance.update(
          registry.address,
          registry.contract.methods.addPredicate(
            MarketplacePredicate.address,
            3 /* Type.Custom */
          ).encodeABI()
        )
        await governance.update(
          registry.address,
          registry.contract.methods.addPredicate(
            TransferWithSigPredicate.address,
            3 /* Type.Custom */
          ).encodeABI()
        )
      })
  })
}
