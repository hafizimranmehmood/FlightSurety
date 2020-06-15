
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Oracles', async (accounts) => {

  const TEST_ORACLES_COUNT = 30;
  
  const STATUS_CODE_UNKNOWN = 0;
  const STATUS_CODE_ON_TIME = 10;
  const STATUS_CODE_LATE_AIRLINE = 20;
  const STATUS_CODE_LATE_WEATHER = 30;
  const STATUS_CODE_LATE_TECHNICAL = 40;
  const STATUS_CODE_LATE_OTHER = 50;

  const airlineFee = web3.utils.toWei('10', 'ether');
  const flight = 'ND1309';
  const timestamp = Math.floor(Date.now() / 1000);

  const pessenger = accounts[6];
  const insuranceFee = web3.utils.toWei('1', 'ether');

  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);

    // lets pay airlien fee and register flight  
    await config.flightSuretyApp.payAirlineRegistrationFee({ from: config.firstAirline, value: airlineFee });
    await config.flightSuretyApp.registerFlight(flight, timestamp, { from: config.firstAirline });

    // pessengers buys the insurance
    await config.flightSuretyApp.buyInsurance(config.firstAirline, flight, timestamp, { from: pessenger, value: insuranceFee });
    // Watch contract events
    

  });


  it('can register oracles', async () => {
    
    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    // ACT
    for(let a=1; a<TEST_ORACLES_COUNT; a++) {      
      let result = await config.flightSuretyApp.registerOracle({ from: accounts[a], value: fee });
      let myIndexes = await config.flightSuretyApp.getMyIndexes.call({from: accounts[a]});
      let indexes = result.logs[0].args[0];
      // console.log(`Oracle Registered: ${myIndexes[0]}, ${myIndexes[1]}, ${myIndexes[2]}`);
      let areIndexesEqual = (myIndexes[0].toNumber() == indexes[0].toNumber() 
        && myIndexes[1].toNumber() == indexes[1].toNumber() 
        && myIndexes[2].toNumber() == indexes[2].toNumber());

      assert(areIndexesEqual, 'problem while registering oracles')
    }
  });

  it('Request flight status and submit oracles responses as delayed, assert in case of wrong event emition', async () => {

    // Submit a request for oracles to get status information for a flight
    let result = await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight, timestamp);
    assert.equal(result.logs[0].event, 'OracleRequest', 'Unable to fetch the flight status');
    // ACT

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    let indexMatchCount = 0;
    let response;
    let reverted;
    for(let a=1; a<TEST_ORACLES_COUNT; a++) {

      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a]});
      for(let idx=0;idx<3;idx++) {

        reverted = false;
        try {
          // Submit a response...it will only be accepted if there is an Index match
          response = await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.firstAirline, flight, timestamp, STATUS_CODE_LATE_AIRLINE, { from: accounts[a] });
        }
        catch(e) {
          // Enable this when debugging
           // console.log('\nError', idx, oracleIndexes[idx].toNumber(), flight, timestamp);
           
           reverted = true; // will revert in caser of index does not match
        }

        if(!reverted){
          let txEvent = response.logs[0].event;
          assert.equal(txEvent, 'OracleReport', 'Wrong event is emitted');  
          indexMatchCount ++;
          if(indexMatchCount == 3)
            assert.equal(response.logs[1].event, 'FlightStatusInfo', 'Wrong event is emitted'); 
        }

      }
    }

  });

  it('Insuree credit amount should be 1.5% of the insurance he paid in case of there is a delay in flight', async () => {
    
    let insuranceAmount = web3.utils.toWei('1', 'ether');
    const creditedAmount = await config.flightSuretyApp.getInsureeCreditAmount.call({from : pessenger});
    assert.equal(creditedAmount, Math.floor(insuranceAmount * 3/2), 'Credited amount is not 1.5% of the actual')
  });

  it('A pessenger should be able to withdraw 1.5% of the insurance he paid in case of there is a delay in flight', async () => {
    
    const initialBalance = new BigNumber(await web3.eth.getBalance(pessenger));
    const result = await config.flightSuretyApp.payInsuree(pessenger, {from: pessenger});
    const currentBalance = new BigNumber(await web3.eth.getBalance(pessenger));

    assert(currentBalance.isGreaterThan(initialBalance), 'Problem in insuree credit amount withdrawal');
  });
 
});
