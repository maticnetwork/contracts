import bip39 from 'bip39'
import wallet from 'ethereumjs-wallet'
import fs from 'fs';

function readJSON (path) {
  return JSON.parse(fs.readFileSync(path));
}

const config = readJSON('package.json').config

export const mnemonics = config.mnemonics
export function generateFirstWallets(mnemonics, n, hdPathIndex = 0) {
  const hdwallet = wallet.hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonics))
  const result = []
  for (let i = 0; i < n; i++) {
    const node = hdwallet.derivePath(`m/44'/60'/0'/0/${i + hdPathIndex}`)
    result.push(node.getWallet())
  }

  return result
}
