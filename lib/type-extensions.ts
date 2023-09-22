// If your plugin extends types from another plugin, you should import the plugin here.

// To extend one of Hardhat's types, you need to import the module where it has been defined, and redeclare it.
import 'hardhat/types/config'
import { extendConfig } from 'hardhat/config'
import { HardhatConfig, HardhatUserConfig } from 'hardhat/types'

declare module 'hardhat/types/config' {
  // by the users. Things are normally optional here.
  export interface HardhatUserConfig {
    verify?: {
      contracts: string[];
    }
  }

  export interface HardhatConfig {
    verify: {
      contracts: string[];
    }
  }

  export interface ProjectPathsUserConfig {
    sourceTemplates: string
  }

  export interface ProjectPathsConfig {
    sourceTemplates: string
  }
}

extendConfig(
  (config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
    let contracts = userConfig.verify?.contracts

    if (contracts === undefined) {
      contracts = []
    }

    if (!config.verify) {
      config.verify = {
        contracts: []
      }
    }

    config.verify.contracts = contracts
    config.paths.sourceTemplates = userConfig.paths?.sourceTemplates!
  }
)
