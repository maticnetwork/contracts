# Moonwalker Migrations

Note: Run all commands from project home folder.

1. Moonwalker needs rabbitmq (Running on these specific ports for now)
```
docker run -d -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

2. Compile contracts
```
npm run truffle:compile
```

3. Export Heimdall ID
```
export HEIMDALL_ID="heimdall-UeagH"
```

3. [queueJobs.js](./queueJobs.js) queues the deployment/setup jobs to rabbit.
```
node moonwalker-migrations/queueJobs.js
```
Kill the script, one you see `undefined` printed at the end (lol hacky). Head to http://localhost:15672/ to check jobs have been queued.

4. [deployWorker.js](./deployWorker.js) starts the deployments.
Set the `from`, `gas`, `gasPrice` and `blockConfirmation` settings in [deployWorker.js](./deployWorker.js).
```
node moonwalker-migrations/deployWorker.js
```
Wait for `job completed` msg. Moonwalker output is written to `build/contracts/status.json`.

5. Write addresses from `build/contracts/status.json` to `contractAddresses.json`.
```
node moonwalker-migrations/addressClipper.js
```

6. Run 4th and 5th migration by following steps in [deploy-migrations/README.md](../deploy-migrations/README.md).

Notes:
If you had to stop deployment in the middle for some reason, remember to purge the Q in rabbit and `rm build/contracts/status.json`

