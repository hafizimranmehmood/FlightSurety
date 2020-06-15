import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json'
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';
require('babel-polyfill');


let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.appAddress);
let oracleNodes;

const Server = {
	
	 init: async () => {
	 	await flightSuretyData.methods.authorizeCaller(flightSuretyApp.address)

		flightSuretyApp.events.OracleRequest()
      		.on('error', error => { console.log(error) })
      		.on('data', async event => {
        		const { index, airline, flight, timestamp } = event.returnValues
        		await Server.triggerOracle(airline, flight, timestamp)
      		}
    	)

      	flightSuretyApp.events.OracleReport()
      	.on('error', error => { console.log(error) })
      		.on('data', async event => {
        		const { airline, flight, timestamp, status } = event.returnValues
        		// console.log(`OracleReport ${airline}, --->${flight}, --->${status}`)
      		}
    	)

      	flightSuretyApp.events.FlightStatusInfo()
      		.on('error', error => { console.log(error) })
      		.on('data', async event => {
      			// console.log(event)
        		const { airline, flight, timestamp, status } = event.returnValues
        		// console.log(`FlightStatusInfo ${airline}, --->${flight}, --->${status}`)
      		}
    	)

  		oracleNodes = await web3.eth.getAccounts()
    	const REGISTRATION_FEE = await flightSuretyApp.methods.REGISTRATION_FEE().call()
    	oracleNodes.forEach(async account => {
      		try {
        		await flightSuretyApp.methods.registerOracle().send({from: account, value: REGISTRATION_FEE, gas: 999999999})
      		}		 
      		catch (e) {
        		
      		}
    	})
	 },

	 triggerOracle: async (airline, flight, timestamp) => {
    	oracleNodes.forEach(async oracle => {
      		const statusCode = Math.floor(Math.random() * 6) * 10;
      		const myOracleIndexes = await flightSuretyApp.methods.getMyIndexes().call({ from: oracle });
      		myOracleIndexes.forEach(async index => {
      			
        		try {
          			await flightSuretyApp.methods.submitOracleResponse(index, airline, flight, timestamp, statusCode).send({ from: oracle, gas: 999999999 });
        		} catch (e) {
          			// fall all those whose index does not match
          			// console.log(e.message);
        		}
     	 	})
    	})
  	}
}

Server.init()

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

export default app;


