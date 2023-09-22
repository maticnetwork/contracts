import { deployPredicate } from '../lib'
import { Artifacts } from 'hardhat/types'

export async function deploy(artifacts: Artifacts, network: string, from: string, params: string) {
  return deployPredicate(artifacts, network, from, params)
}
