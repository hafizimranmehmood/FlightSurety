import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
// var BigNumber = require('bignumber.js');

export default class Contract {
    constructor(network, callback) {

        let config = Config[network];
        // this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        let web3Provider = new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws'));
        this.web3 = new Web3(web3Provider);
        // web3.eth.defaultAccount = web3.eth.accounts[1];
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.flightSuretyApp.setProvider(web3Provider);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
        this.initialize(callback);
    }

    initialize(callback) {
        this.web3.eth.getAccounts((error, accts) => {
           
            this.owner = accts[0];
            let counter = 1;
            
            while(this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            while(this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }

            callback();
        });
    }

    async isOperational() {
        return await this.flightSuretyApp.methods.isOperational().call();
    }

    async toggleOperationState() {
        let result = await this.isOperational();
        try{
            await this.flightSuretyApp.methods.setOperatingStatus(!result).send({from: this.owner});
            return !result;
        }catch(e){
            console.log(e);
            return true;
        }
    }

    //TODO
    // fetchFlightStatus(flight, callback) {
    //     let self = this;
    //     let payload = {
    //         airline: self.airlines[0],
    //         flight: flight,
    //         timestamp: Math.floor(Date.now() / 1000)
    //     } 
    //     self.flightSuretyApp.methods
    //         .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
    //         .send({ from: self.owner}, (error, result) => {
    //             callback(error, payload);
    //         });
    // }

    async registerAirline(airline, name, _from, callback) {
        this.flightSuretyApp.events.AirlineRegistrationStatus()
            .on('error', error => { console.log(error) })
            .on('data', async event => {
                // console.log(event)
                const { registered, votesLeft } = event.returnValues
                if(votesLeft !== null)
                    callback(registered, votesLeft);
            }
        )
        await this.flightSuretyApp.methods.registerAirline(airline, name).send({from: _from, gas: 999999999});
    }

    async payAirlineRegistrationFee(_from, regFee){
        let fee = this.web3.utils.toWei(regFee, 'ether');
        return await this.flightSuretyApp.methods.payAirlineRegistrationFee().send({from: _from, value: fee, gas: 999999999});   
    }

    async registerFlight(airline, flightNumber, departureTime){
        return await this.flightSuretyApp.methods.registerFlight(flightNumber, departureTime).send({from: airline, gas: 999999999});
    }

    async getFlight(flightId){
        let result = await this.flightSuretyApp.methods.getFlight(flightId).call();
        return result;
    }

    async fetchFlightStatus(fId, callback) {
        let res = await this.getFlight(fId);
        this.flightSuretyApp.events.OracleRequest()
            .on("data", async event => {
                const {index, airline, flight, timestamp} = event.returnValues;
        });

        this.flightSuretyApp.events.FlightStatusInfo()
            .on('error', error => { console.log(error) })
            .on('data', async event => {
                // console.log(event)
                const { airline, flight, timestamp, status } = event.returnValues
                if(status){ 
                    callback(status);
                }
            }
        )
        
        await this.flightSuretyApp.methods.fetchFlightStatus(res.airline, res.flightNumber, res.departureTime).send({from: res.airline, gas: 999999999});
    }

    async buyInsurance(fromPassenger, flightId, amount){
        let res = await this.getFlight(flightId);
        let insuranceAmount = this.web3.utils.toWei(amount, "ether");
        return await this.flightSuretyApp.methods.buyInsurance(res.airline, res.flightNumber, res.departureTime).send({from: fromPassenger, value: insuranceAmount, gas: 999999999});
    }

    async getInsurance(insuranceId){
        let result = await this.flightSuretyApp.methods.getInsurance(insuranceId).call();
        return result;
    }

    async getInsureeCreditAmount(passengerId){
        return await this.flightSuretyApp.methods.getInsureeCreditAmount().call({from: passengerId});
    }

    async payInsuree(passengerId){
        return await this.flightSuretyApp.methods.payInsuree(passengerId).send({from: passengerId, gas: 999999999});
    }

}