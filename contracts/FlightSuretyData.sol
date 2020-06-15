pragma solidity >= 0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false

    
    struct Airline {
        string name;
        bool registered;
        bool paidFee;
    }

    struct Flight {
        uint id;
        address airline;
        string flightNumber;
        uint8 statusCode;
        uint departureTime;
    }

    enum InsuranceState { 
        Unknown, 
        Active, 
        Credited 
    }

    struct Insurance {
        uint id;
        address passenger;
        InsuranceState state;
        string flightNumber;
        uint amount;
    }

    uint public totalRegisteredAirlines;
    address public firstRegisteredAirline;
    mapping(address => bool) public authorizedCallers;
    mapping(address => Airline) public airlines;
    mapping(bytes32 => Flight) private flights;
    mapping(uint => Insurance) public insurances;
    mapping(bytes32 => uint[]) private flightInsurances;
    mapping(address => uint) public creditedInsurees;
    mapping(uint => bytes32) public flightIndexes;
    uint internal flightId;
    uint internal insuranceId;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    event AirlineRegistered();
    event FlightStatusCodeChanged();


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor(address firstAirline) public 
    {
        contractOwner = msg.sender;

        totalRegisteredAirlines = totalRegisteredAirlines.add(1);
        firstRegisteredAirline = firstAirline;
        airlines[firstAirline] = Airline(
            "GoAir", 
            true, 
            false
        );
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not a contract owner");
        _;
    }

    modifier requireCallerAuthorized() {
        require(authorizedCallers[msg.sender], "Caller is not authorized to call this function");
        _;
    }

    modifier requireAirlineExists(address airline)
    {
        require(airlines[airline].registered, "Airline does not exists");
        _;
    }

    modifier checkFlightExists(bytes32 flightKey)
    {
        require(flights[flightKey].id > 0, "No such flight");
        _;
    }

    modifier checkInsuranceExists(uint _insuranceId)
    {
        require(insurances[_insuranceId].id > 0, "Insurance does not exists.");
        _;
    }

    modifier checkIfIsureeCanCredited(uint _insuranceId)
    {
        require(insurances[_insuranceId].state == InsuranceState.Active, "Unable to credit insurance");
        _;
    }

    modifier checkInsureeCanWithdraw(address insuree)
    {
        require(creditedInsurees[insuree] > 0, "The insuree does not have enough amount to withdraw");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() 
                            public 
                            view 
                            returns(bool) 
    {
        return operational;
    }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus
                            (
                                bool mode
                            ) 
                            external 
    {
        require(msg.sender == contractOwner || authorizedCallers[msg.sender], "Caller is not a contract owner or an authorized address");
        require(operational != mode, "Already in requested state");
        operational = mode;
    }

    function authorizeCaller(address caller)
        external
        requireContractOwner
        requireIsOperational
    {
        authorizedCallers[caller] = true;
    }

    function setTestingMode (bool mode) 
        requireIsOperational
        public 
    {
        
    }

    function isAirLineRegistered (address airline) 
        requireIsOperational
        requireAirlineExists(airline)
        external view returns(bool) 
    {
        return airlines[airline].registered;
    }
    
    

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline(address _airline, string calldata _name, bool _paidFunds)
        requireIsOperational
        requireCallerAuthorized
        external
    {
        require (!airlines[_airline].registered, "Airline already registered");
        totalRegisteredAirlines = totalRegisteredAirlines.add(1);
        airlines[_airline] = Airline(
            _name, 
            true, 
            _paidFunds
        );
    }

    function getAirline (address _airline) 
        requireIsOperational
        requireAirlineExists(_airline)
        external
        view
        returns (string memory name, bool registered, bool paidFee)
    {
        Airline memory airline = airlines[_airline];

        name = airline.name;
        registered = airline.registered;
        paidFee = airline.paidFee;
    }


   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buyInsurance(bytes32 flightKey, string calldata flightNumber, address passenger, uint amountPaid)
        external
        requireIsOperational
        requireCallerAuthorized
        checkFlightExists(flightKey)
    {
        insuranceId = insuranceId.add(1);
        insurances[insuranceId] = Insurance(
            insuranceId,
            passenger,
            InsuranceState.Active,
            flightNumber,
            amountPaid
        );

        flightInsurances[flightKey].push(insuranceId);
    }

    function getInsurance (uint insId) 
        requireIsOperational
        checkInsuranceExists(insId)
        external
        view
        returns (uint id, address passenger, string memory state, string memory flightNumber, uint amount)
    {
        
        Insurance memory insurance = insurances[insId];

        require (insurance.id > 0, 'No insurance against this id');

        id = insurance.id;
        passenger = insurance.passenger;
        if(insurance.state == InsuranceState.Unknown) {
            state = "Unknown";
        }
        if(insurance.state == InsuranceState.Active) {
            state = "Active";
        }
        if(insurance.state == InsuranceState.Credited) {
            state = "Credited";
        }
        flightNumber = insurance.flightNumber;
        amount = insurance.amount;
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsuree(uint _insuranceId, uint _creditAmount)
        requireIsOperational
        requireCallerAuthorized
        checkInsuranceExists(_insuranceId)
        checkIfIsureeCanCredited(_insuranceId)
        external
    {
        Insurance memory insurance = insurances[_insuranceId];
        creditedInsurees[insurance.passenger] = _creditAmount;
        insurances[_insuranceId].state = InsuranceState.Credited;
    }

    function getInsureeCreditAmount (address insuree) 
        requireIsOperational
        checkInsureeCanWithdraw(insuree)
        external view returns(uint) 
    {
        return creditedInsurees[insuree];
    }

    function getInsurees(bytes32 flightKey) 
        requireIsOperational
        checkFlightExists(flightKey)
        public view returns (uint[] memory)
    {
        return flightInsurances[flightKey];
    }

    function getInsuranceAmount (uint _insuranceId) 
        requireIsOperational
        checkInsuranceExists(_insuranceId)
        external view returns(uint) 
    {
        return insurances[_insuranceId].amount;
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function payInsuree(address insuree)
        requireIsOperational
        requireCallerAuthorized
        checkInsureeCanWithdraw(insuree)
        external
        payable
    {
        uint amountToPaid = creditedInsurees[insuree];
        require(address(this).balance >= amountToPaid, "Contract does not have enough funds to pay insuree");
        
        creditedInsurees[insuree] = 0;
        address payable insureePayable = address(uint160(insuree));
        insureePayable.transfer(amountToPaid);
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function paidAirlineRegistrationFee(address airline)
        requireIsOperational
        requireCallerAuthorized
        requireAirlineExists(airline)
        external
    {
        airlines[airline].paidFee = true;
    }

    function isRegistrationFeePaid (address airline)
        requireIsOperational
        requireAirlineExists(airline)
        external view
        returns(bool)  
    {
        return airlines[airline].paidFee;
    }
    

    function registerFlight(address airline, string calldata flightNumber, uint departureTime)
        requireIsOperational
        requireCallerAuthorized
        requireAirlineExists(airline)
        external
    {
        flightId = flightId.add(1);
        bytes32 flightKey = getFlightKey(airline, flightNumber, departureTime);
        flights[flightKey] = Flight(
            flightId,
            airline,
            flightNumber,
            0,
            departureTime
        );

        flightIndexes[flightId] = flightKey;
    }

    function getFlight (uint fId) 
        requireIsOperational
        checkFlightExists(flightIndexes[fId])
        external
        view
        returns (uint id, address airline, string memory flightNumber, uint8 statusCode, uint departureTime)
    {
        Flight memory flight = flights[flightIndexes[fId]];
        
        require(flight.id > 0, 'No such flight');

        id = flight.id;
        airline = flight.airline;
        flightNumber = flight.flightNumber;
        statusCode = flight.statusCode;
        departureTime = flight.departureTime;
    }
    

    function isFlightRegistered (bytes32 flightKey)
        requireIsOperational
        checkFlightExists(flightKey)
        public view returns(bool) 
    {
        return flights[flightKey].id > 0;    
    }
    

    function processFlightStatus (bytes32 flightKey, uint8 _statusCode) 
        requireIsOperational
        requireCallerAuthorized
        checkFlightExists(flightKey)
        external
    {
        flights[flightKey].statusCode = _statusCode;
        //emit 
    }
    

    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() 
                            external 
                            payable 
    {
    
    }


}

