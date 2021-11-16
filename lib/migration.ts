import chalk from 'chalk'
import { cc, GovernanceRepositoryLink } from '../lib'

export async function printGovernanceUpdateCommand(target: string, contract: string, data: string) {
  cc.log(`Use this command in our ${GovernanceRepositoryLink} repository to generate multisig transaction data:`)

    const encodedCall = `npx hardhat encode-update-governance-data --target ${target} --contract ${contract} --data ${data}`

    await cc.intendGroup(async() => cc.log(chalk.bgBlack(chalk.yellowBright(encodedCall))))
}

export async function printProxyUpdateCommand(proxy: string, implementation: string) {
  cc.log(`Use this command in our ${GovernanceRepositoryLink} repository to generate transaction data:`)

    const encodedCall = `npx hardhat encode-update-proxy-data --proxy ${proxy} --implementation ${implementation}`

    await cc.intendGroup(async() => cc.log(chalk.bgBlack(chalk.yellowBright(encodedCall))))
}
