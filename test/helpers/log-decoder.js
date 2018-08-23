import ethers from 'ethers'

export default class LogDecoder {
  constructor(abis = []) {
    this._methodIDs = {}
    abis.forEach(abi => {
      const methodInterface = new ethers.Interface(abi)
      Object.keys(methodInterface.events).forEach(evtKey => {
        const evt = methodInterface.events[evtKey]
        const signature = evt.topics[0]
        // Handles different indexed arguments with same signature from different contracts
        // Like ERC721/ERC20 Transfer
        this._methodIDs[signature] = this._methodIDs[signature] || []
        this._methodIDs[signature].push(evt)
      })
    })
  }

  decodeLogs(logs) {
    return logs.map(log => {
      const evts = this._methodIDs[log.topics[0]]
      for (let index = 0; index < evts.length; index++) {
        const evt = evts[index]
        try {
          return {
            address: log.address.toLowerCase(),
            event: evt.name,
            signature: evt.signature,
            args: evt.parse(log.topics, log.data)
          }
        } catch (e) {}
      }

      throw new Error("Log doesn't match")
    })
  }
}
