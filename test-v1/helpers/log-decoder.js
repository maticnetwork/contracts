import { ethers } from 'ethers'

export default class LogDecoder {
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
        } catch (e) {}
      }

      throw new Error("Log doesn't match")
    })
  }
}
