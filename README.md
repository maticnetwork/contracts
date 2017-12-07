# Matic contracts

Matic contracts are ethereum smart contracts to power [Matic Network](https://matic.network).

### Goal

The goal is to transfer tokens and ethers off-chain instantly and trustlessly without creating direct/multiple payment channels and without using channel network.

### How it works?

User creates [Matic contract](https://github.com/maticnetwork/contracts/blob/master/contracts/MaticChannel.sol) and deposits tokens into contract. User can make multiple deposits in the lifetime of contract. User now [signs](https://github.com/ethereum/EIPs/pull/712) the transafer transaction and sends it to other party (say, receiver). If receiver validates the transaction, transfer considered to be complete. User can transfer tokens many times if total transferred amount is less than or equals to the total deposited amount.

Receiver can withdraw anytime using received transaction signatures instantly. When user wants to withdraw the remaning tokens or ethers, she initiates time-based window (challenge period) on Matic contract. If validation is sucessefull, the process of withdrawing starts. That window helps receivers to withdraw their tokens if they haven't already. After challenge period ends, withdraw will be finalized.

### Getting Started

```
npm install
```

### License

MIT
