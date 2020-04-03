# Moonwalker Migrations

Note: Run all commands from project home folder.

1. Moonwalker needs rabbitmq (Running on these specific ports for now)
```
docker run -d -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

2. Compile contracts
```
npm run template:process -- --bor-chain-id <bor-chain-id>
for instance, npm run template:process -- --bor-chain-id 15001

npm run truffle:compile
```

3. Export Heimdall ID
```
export HEIMDALL_ID="heimdall-UeagH"
```

3. [1_queueJobs.js](./1_queueJobs.js) queues the contract deployment jobs to rabbit.
```
node moonwalker-migrations/1_queueJobs.js
```
Head to http://localhost:15672/ to check jobs have been queued.

4. [deployWorker.js](./deployWorker.js) starts the deployments.
Set the `from`, `gas`, `gasPrice` and `blockConfirmation` settings in [deployWorker.js](./deployWorker.js).
```
node moonwalker-migrations/deployWorker.js
```
Wait for `job completed` msg. Moonwalker output is written to `build/status.json`.

5. Queue second set of jobs, which are mostly contract initial state setup. Using truffe exec because it makes use of truffle artifacts.
```
npm run truffle exec moonwalker-migrations/2_queueJobs.js
```

6. Deploy the jobs above
```
node moonwalker-migrations/deployWorker.js
```

7. Write addresses from `build/status.json` to `contractAddresses.json`.
```
node moonwalker-migrations/addressClipper.js
```

8. Run 4th and 5th migration by following steps in [deploy-migrations/README.md](../deploy-migrations/README.md).

Notes:
If you had to stop deployment in the middle for some reason, remember to purge the Q in rabbit and `rm build/status.json`
