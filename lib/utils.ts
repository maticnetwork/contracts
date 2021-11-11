import solc from 'solc'

const SolidityBinaries = {
  '0.5.17': 'v0.5.17+commit.d19bba13'
}

export async function getPkgJsonDir() {
  const { dirname } = require('path')
  const { constants, promises: { access } } = require('fs')

  for (const path of module.paths) {
    try {
      const prospectivePkgJsonDir = dirname(path)
      await access(path, constants.F_OK)
      return prospectivePkgJsonDir
    } catch (e) {}
  }
}

export function hasValue(value: any) {
  return value !== undefined && value !== null
}

export function loadSolcBinary(solidityVerstion: string) {
  return new Promise((resolve, reject) => {
    solc.loadRemoteVersion(SolidityBinaries[solidityVerstion], function(err: any, snapshot: any) {
      if (err) {
        reject(err)
      } else {
        resolve(snapshot)
      }
    })
  })
}
