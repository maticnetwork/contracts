export class LogDecoder {
  decodeLogs(logs, ...contractInterfaces) {
    contractInterfaces.forEach((contractInterface) => {
      logs = logs.map((log) => {
        try {
          const parsedLog = contractInterface.parseLog(log)
          return {
            address: log.address.toLowerCase(),
            event: parsedLog.name,
            signature: parsedLog.signature,
            args: parsedLog.args
          }
        } catch (e) {
          return log
        }
      })
    })
    return logs
  }
}

const logDecoder = new LogDecoder()
export default logDecoder
