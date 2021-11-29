export class StorageError {
  public warning: boolean
  public message: string

  constructor(isWarning: boolean, messsage: string) {
    this.warning = isWarning
    this.message = messsage
  }
}

export class VerificationFailed extends Error {
  contractName: string

  constructor(contractName: string) {
    super(`${contractName} does not match compiled bytecode`)

    this.contractName = contractName
  }
}

export class ProxyImplementationHasChanged extends Error {
  contractName: string

  constructor(contractName: string) {
    super(`${contractName} doesn't match deployed implementation`)

    this.contractName = contractName
  }
}
