import bip39 from 'bip39'
import hdkey from 'ethereumjs-wallet/hdkey'

import packageJSON from '../../package.json'

export const mnemonics = packageJSON.config.mnemonics
export function generateFirstWallets(mnemonics, n, hdPathIndex = 0) {
  const hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonics))
  const result = []
  for (let i = 0; i < n; i++) {
    const node = hdwallet.derivePath(`m/44'/60'/0'/0/${i + hdPathIndex}`)
    result.push(node.getWallet())
  }

  return result
}
