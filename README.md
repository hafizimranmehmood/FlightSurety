# Flight Surety
## How to run
### System Requirements
1. Node v13.11.0
2. Truffle v5.1.13
3. Web3.js v1.2.4

### Setup
#### Obtain the code
1. Downwload and unzip this repo to a folder on your machine.
2. Open Terminal in this folder
3. Run:
```bash
npm install
```

#### Start Ganache
You will need specific configuration of ganache. So run:
```bash
ganache-cli -l 999999999999 -m "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat" -a30 -e 10000
```
This command will create the local test network with the following props:
1. gas limit = 999999999999
2. test accounts = 30
3. ether on each test account = 10000


#Develop Client

To run truffle tests:
```bash
truffle test ./test/flightSurety.js truffle test ./test/oracles.js
```

#### Start Dapp
Dapp that will allow you to interact with deployed contracts running on `localhost:8000`.
In the project folder run:
```bash
npm run dapp
```


To set everything up again, run in the project folder
```bash
> ganache-cli -l 999999999999 -m "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat" -a30 -e 10000
> truffle migrate 
> npm run server
> npm run dapp
```
Now open the `locallhost:8000` in your browser.

