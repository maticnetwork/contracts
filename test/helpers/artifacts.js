import hardhat from 'hardhat'
const ethers = hardhat.ethers

export const RootChain = await ethers.getContractFactory('RootChain')
export const RootChainProxy = await ethers.getContractFactory('RootChainProxy')
export const Registry = await ethers.getContractFactory('Registry')
export const Governance = await ethers.getContractFactory('Governance')
export const GovernanceLockableTest = await ethers.getContractFactory('GovernanceLockableTest')
export const GovernanceProxy = await ethers.getContractFactory('GovernanceProxy')
export const StakeManager = await ethers.getContractFactory('StakeManager')
export const StakeManagerExtension = await ethers.getContractFactory('StakeManagerExtension')
export const StakeManagerTest = await ethers.getContractFactory('StakeManagerTest')
export const StakeManagerProxy = await ethers.getContractFactory('StakeManagerProxy')
export const DrainStakeManager = await ethers.getContractFactory('DrainStakeManager')

export const StakingInfo = await ethers.getContractFactory('StakingInfo')
export const EventsHubProxy = await ethers.getContractFactory('EventsHubProxy')
export const EventsHub = await ethers.getContractFactory('EventsHub')
export const StakingNFT = await ethers.getContractFactory('StakingNFT')
export const ValidatorShareProxy = await ethers.getContractFactory('ValidatorShareProxy')
export const ValidatorShare = await ethers.getContractFactory('ValidatorShareTest')

export const StakeManagerTestable = await ethers.getContractFactory('StakeManagerTestable')
export const ValidatorShareFactory = await ethers.getContractFactory('ValidatorShareFactory')
export const SlashingManager = await ethers.getContractFactory('SlashingManager')

export const DepositManager = await ethers.getContractFactory('DepositManager')
export const DepositManagerProxy = await ethers.getContractFactory('DepositManagerProxy')
export const Drainable = await ethers.getContractFactory('Drainable')
export const WithdrawManager = await ethers.getContractFactory('WithdrawManager')
export const WithdrawManagerProxy = await ethers.getContractFactory('WithdrawManagerProxy')
export const StateSender = await ethers.getContractFactory('StateSender')

export const ContractWithFallback = await ethers.getContractFactory('ContractWithFallback')
export const ContractWithoutFallback = await ethers.getContractFactory('ContractWithoutFallback')
export const ContractWitRevertingFallback = await ethers.getContractFactory('ContractWitRevertingFallback')

export const ERC20PredicateBurnOnly = await ethers.getContractFactory('ERC20PredicateBurnOnly')
export const ERC721PredicateBurnOnly = await ethers.getContractFactory('ERC721PredicateBurnOnly')

// tokens
export const MaticWETH = await ethers.getContractFactory('MaticWETH')
export const TestToken = await ethers.getContractFactory('TestToken')
export const RootERC721 = await ethers.getContractFactory('RootERC721')
export const ERC721PlasmaMintable = await ethers.getContractFactory('ERC721PlasmaMintable')
export const ExitNFT = await ethers.getContractFactory('ExitNFT')

// Misc
export const GnosisSafeProxy = await ethers.getContractFactory('GnosisSafeProxy')
export const GnosisSafe = await ethers.getContractFactory('GnosisSafe')
export const PolygonMigrationTest = await ethers.getContractFactory('PolygonMigrationTest')

// child chain
if (!process.env.BOR_CHAIN_URL) {
    throw("BOR_CHAIN_URL not defined in .env")
}
const borProvider = new ethers.providers.JsonRpcProvider(process.env.BOR_CHAIN_URL)
let childSigner = borProvider.getSigner()

if (hre.__SOLIDITY_COVERAGE_RUNNING) {
    childSigner = undefined
}

export const ChildChain = await ethers.getContractFactory('ChildChain', childSigner)
export const ChildTokenProxy = await ethers.getContractFactory('ChildTokenProxy', childSigner)
export const ChildERC20 = await ethers.getContractFactory('ChildERC20', childSigner)
export const ChildERC20Proxified = await ethers.getContractFactory('ChildERC20Proxified', childSigner)
export const ChildERC721 = await ethers.getContractFactory('ChildERC721', childSigner)
export const ChildERC721Proxified = await ethers.getContractFactory('ChildERC721Proxified', childSigner)
export const ChildERC721Mintable = await ethers.getContractFactory('ChildERC721Mintable', childSigner)
export const MRC20 = await ethers.getContractFactory('MRC20', childSigner)
export const TestMRC20 = await ethers.getContractFactory('TestMRC20', childSigner)
