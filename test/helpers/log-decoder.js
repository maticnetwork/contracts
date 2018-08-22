import ethers from 'ethers'

export default class LogDecoder {
  constructor(abis = []) {
    this._methodIDs = {}
    abis.forEach(abi => {
      const methodInterface = new ethers.Interface(abi)
      Object.keys(methodInterface.events).forEach(evtKey => {
        const evt = methodInterface.events[evtKey]
        const signature = evt.topics[0]
        this._methodIDs[signature] = evt
      })
    })
  }

  decodeLogs(logs) {
    return logs.map(log => {
      const evt = this._methodIDs[log.topics[0]]
      return {
        address: log.address.toLowerCase(),
        event: evt.name,
        signature: evt.signature,
        args: evt.parse(log.topics, log.data)
      }
    })
  }
}
