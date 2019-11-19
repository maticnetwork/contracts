import { ethers } from 'ethers'
import * as contracts from './artifacts.js'

export class LogDecoder {
  constructor(abis = []) {
    this._methodIDs = {}
    this._interfaces = []
    abis.forEach(abi => {
      const methodInterface = new ethers.utils.Interface(abi)
      Object.keys(methodInterface.events).forEach(evtKey => {
        const evt = methodInterface.events[evtKey]
        const signature = evt.topic
        // Handles different indexed arguments with same signature from different contracts
        // Like ERC721/ERC20 Transfer
        this._methodIDs[signature] = this._methodIDs[signature] || []
        this._methodIDs[signature].push(evt)
        this._interfaces.push(methodInterface)
      })
    })
  }
  decodeLogs(logs = []) {
    return logs.map(log => {
      for (let i = 0; i < this._interfaces.length; i++) {
        // todo :please optimize me
        try {
          const parsedLog = this._interfaces[i].parseLog(log)
          if (parsedLog) {
            return {
              address: log.address.toLowerCase(),
              event: parsedLog.name,
              signature: parsedLog.signature,
              args: parsedLog.values
            }
          }
        } catch (e) {
        }
      }
    })
  }
}

const abis = []

Object.keys(contracts).forEach(c => {
  if (c === 'childContracts') {
    Object.keys(contracts[c]).forEach(_c => {
      abis.push(contracts[c][_c]._json.abi)
    })
  } else {
    abis.push(contracts[c]._json.abi)
  }
})

const logDecoder = new LogDecoder(abis)
export default logDecoder
