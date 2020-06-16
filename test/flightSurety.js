
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  const airlineFee = web3.utils.toWei('10', 'ether');
  const flightNumber = "ND1309";
  const departureTime = 10002000;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {

    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
            
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.owner });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true, { from: config.owner });
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      await config.flightSuretyData.setOperatingStatus(false, { from: config.owner });

      let reverted = false;
      try 
      {
          await config.flightSuretyData.setTestingMode(true, { from: config.firstAirline });
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true, { from: config.owner });

  });

  it('registered airline cannot register an another airline if it has not paid the registration fee', async () => {
    
    // ARRANGE
    let newAirline = accounts[2];

    let reverted = false;
    try {
      await config.flightSuretyApp.registerAirline(newAirline, "NewAir", {from: config.firstAirline});
    }catch(e) {
      reverted = true;  
    }
    
    // ASSERT
    assert.equal(reverted, true, "Airline should not be able to register another airline if they has not paid the registration fee");

  });

  it('Airline can pay registration fee', async () => {
    const initialBalance = await web3.eth.getBalance(config.flightSuretyData.address);
    await config.flightSuretyApp.payAirlineRegistrationFee({ from: config.firstAirline, value: airlineFee, gas: 999999999});

    const airline = await config.flightSuretyData.airlines.call(config.firstAirline);
    assert(airline.paidFee, 'Airline should be able to pay fee');
    const currentBalance = new BigNumber(await web3.eth.getBalance(config.flightSuretyData.address));
    const balance = new BigNumber((initialBalance + airlineFee));

    assert(currentBalance.isEqualTo(balance), 'Balance should be 10 ETH or more')
  })

  it('Airline should register an another airline after paying fee', async () => {
    
    // ARRANGE
    let newAirline = accounts[2];

    await config.flightSuretyApp.registerAirline(newAirline, "SecondAir", {from: config.firstAirline, gas: 999999999});
    let result = await config.flightSuretyData.isAirLineRegistered.call(newAirline); 

    // ASSERT
    assert.equal(result, true, "Airline should be able to register another airline after paying fee");

  });

  it('any registered airline if total airlines less than 4, can register an another airline after paying fee', async () => {
    
    // ARRANGE
    let newAirline = accounts[3];

    // ACT
    await config.flightSuretyApp.payAirlineRegistrationFee({ from: accounts[2], value: airlineFee, gas: 999999999 })
    await config.flightSuretyApp.registerAirline(newAirline, "ThirdAir", {from: accounts[2], gas: 999999999});

    let total = await config.flightSuretyData.totalRegisteredAirlines.call();
    let result = await config.flightSuretyData.isAirLineRegistered.call(newAirline); 

    // ASSERT
    assert.equal(total < 4, true, "total airlines should less than 4");
    assert.equal(result, true, "Any registered airline should be able to register another airline after paying fee");

  });

  it('(multiparty) After adding the 4th airline, 50% consensus needed from registed airlines to register a new airline', async () => {
    
    await config.flightSuretyApp.registerAirline(accounts[4], "FourthAir", {from: config.firstAirline, gas: 999999999});
    
    let count = await config.flightSuretyData.totalRegisteredAirlines.call();
    assert.equal(count, 4, "Count should be 4 now");

    await config.flightSuretyApp.registerAirline(accounts[5], "FifthAir", {from: config.firstAirline});
    const votesPolled = await config.flightSuretyApp.votesPolledForConsensus.call({from: accounts[5]});

    assert.equal(votesPolled.toNumber(), 1, 'Total of votes polled should be 1');
    
    let reverted = false;
    try {
      await config.flightSuretyData.isAirLineRegistered.call(accounts[5]);
    }catch(e) {
      reverted = true;
    }
    assert.equal(reverted, true, '5th airline should not registered before 50% consensus');
  });

  it('(multiparty) Same airline should not be able to poll vote again to register new airline, 50% consensus needed from registed airlines to register a new airline', async () => {

    let reverted = false;
    try {
      await config.flightSuretyApp.registerAirline(accounts[5], "FifthAir", { from: config.firstAirline })
    } catch (error) {
        reverted = true;
    }

    assert.equal(reverted, true, 'Same arline should not be able to vote again')

    
    await config.flightSuretyApp.registerAirline(accounts[5], "FifthAir", { from: accounts[2]})

    let isRegistered = await config.flightSuretyData.isAirLineRegistered.call(accounts[5])
    assert(isRegistered, '5th airline should get registered after 50% multi-party consensus')
  });
 
  it('An airline should be able to register a flight', async () => {
    const result = await config.flightSuretyApp.registerFlight(flightNumber, departureTime, { from: config.firstAirline , gas: 999999999});
    assert.equal(result.logs[0].event, 'FlightRegistered', "Error while registering a flight");

    const flightKey = await config.flightSuretyApp.getFlightKey(config.firstAirline, flightNumber, departureTime);
    const registered = await config.flightSuretyData.isFlightRegistered.call(flightKey);
    assert(registered, true, 'No flight exists in data contract');
  });

  it('A pessenger should not be able to pay more than the upper cap of a valid flight insurance ', async () => {
    let insuranceFee = web3.utils.toWei('2', 'ether');
    let reverted = false;
    try {
        const result = await config.flightSuretyApp.buyInsurance(config.firstAirline, flightNumber, departureTime, { from: accounts[6], value: insuranceFee });
    } catch (error) {
        reverted = true;
    }

    assert.equal(reverted, true, 'pessenger should be not be able to pay more than the upper cap of a valid flight insurance')
  })

  it('A pessenger should be able to buy insurance of a valid flight', async () => {
    let insuranceFee = web3.utils.toWei('1', 'ether');
    let reverted = false;
    try {
        const result = await config.flightSuretyApp.buyInsurance(config.firstAirline, flightNumber, departureTime, { from: accounts[6], value: insuranceFee, gas: 999999999 });
    } catch (error) {
        reverted = true;
    }

    assert.equal(reverted, false, 'pessenger should be able to buy insurance of a valid flight')
  });

  it('A pessenger should not be able to buy insurance of an invalid flight', async () => {
    let insuranceFee = web3.utils.toWei('1', 'ether');
    let reverted = false;
    try {
        const result = await config.flightSuretyApp.buyInsurance(config.firstAirline, "BCN4321", departureTime, { from: accounts[6], value: insuranceFee });
    } catch (error) {
        reverted = true;
    }

    assert.equal(reverted, true, 'pessenger should be not be able to buy insurance of an  invalid flight')
  });

  it('Insuree credit amount should be 1.5% of the insurance he paid in case of there is a delay in flight', async () => {
    
    let insuranceAmount = web3.utils.toWei('1', 'ether');
    const result = await config.flightSuretyApp.processFlightStatus(config.firstAirline, flightNumber, departureTime, 20, {from: config.firstAirline, gas: 999999999});
    const flight = await config.flightSuretyApp.getFlight.call(1, {from : accounts[6]});
    const creditedAmount = await config.flightSuretyApp.getInsureeCreditAmount.call({from : accounts[6]});
    assert.equal(creditedAmount, Math.floor(insuranceAmount * 3/2), 'Credited amount is not 1.5% of the actual')
  });

  it('Flight status should change to delayed due to airline (20)', async () => {
    
    const flight = await config.flightSuretyApp.getFlight.call(1, {from : accounts[6]});
    assert.equal(flight.statusCode.toNumber(), 20, 'Flight status should be delayed due to airline')
  });

  it('A pessenger should be able to withdraw 1.5% of the insurance he paid in case of there is a delay in flight', async () => {
    
    const initialBalance = new BigNumber(await web3.eth.getBalance(accounts[6]));
    const result = await config.flightSuretyApp.payInsuree(accounts[6], {from: accounts[6], gas: 999999999});
    const currentBalance = new BigNumber(await web3.eth.getBalance(accounts[6]));

    assert(currentBalance.isGreaterThan(initialBalance), 'Problem in insuree credit amount withdrawal');
  });

});
