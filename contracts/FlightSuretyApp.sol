pragma solidity >= 0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    uint private constant M = 2;
    uint private constant INSURANCE_CAP  = 1 ether;
    uint private constant AIRLINE_REGISTRATION_FEE = 10 ether;
    address private contractOwner;          // Account used to deploy contract
    bool private operational = true;
    mapping(address => address[]) private airlineVotes;
    FlightSuretyData internal fsDataContract;

    event AirlineRegistrationStatus(bool registered, uint votesLeft);
    event FlightRegistered();

    // struct Flight {
    //     bool isRegistered;
    //     uint8 statusCode;
    //     uint256 updatedTimestamp;        
    //     address airline;
    // }
    // mapping(bytes32 => Flight) private flights;

 
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
         // Modify to call data contract's status
        require(operational, "Contract is currently not operational");  
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireAirlineRegistered() 
    {
        require(fsDataContract.isAirLineRegistered(msg.sender), "Airline needs to register first to perform such actions");
        _;
    }

    modifier paidEnough(uint amount)
    {
        require(msg.value >= amount, "The amount is less than what is required");
        _;
    }

    modifier returnExtraAmout(uint amount)
    {
        _;
        uint amountToReturn = msg.value.sub(amount);
        if(amountToReturn > 0)
            msg.sender.transfer(amountToReturn);
    }

    modifier requirePaidRegistrationFee()
    {
        require(fsDataContract.isRegistrationFeePaid(msg.sender), "Airline needs to pay registration fee first");
        _;
    }

    modifier amountExceedsInsuranceCap()
    {
        require(msg.value <= INSURANCE_CAP, "The amount exceeds the current insurance cap");
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor(address dataContract) public 
    {
        contractOwner = msg.sender;
        fsDataContract = FlightSuretyData(dataContract);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() 
                            public 
                            view 
                            returns(bool) 
    {
        return operational;  // Modify to call data contract's status
    }

    function setOperatingStatus(bool mode) external requireContractOwner
    {
        // Fail fast
        require(operational != mode, 'Aready in the requested state');
        fsDataContract.setOperatingStatus(mode);
        operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

  
   /**
    * @dev Add an airline to the registration queue
    *
    */   
    function registerAirline(address airline, string memory name)
        requireIsOperational
        requireAirlineRegistered
        requirePaidRegistrationFee
        public
    {
        uint totalRegisteredAirlines = fsDataContract.totalRegisteredAirlines();
        if (totalRegisteredAirlines < 4) {
            // As total registered airlines are less than 4 
            // so any registered airline can register new airline
            fsDataContract.registerAirline(airline, name, false);

            emit AirlineRegistrationStatus(true, 0);
        } else {
            // use mapping instead of array, 
            //as array will effect gas cost, may be another lockout situation
            // as if the array is too long
            bool isDuplicate = false;
            for(uint index = 0; index < airlineVotes[airline].length; index++) { 
                if (airlineVotes[airline][index] == msg.sender) {
                    isDuplicate = true;
                    break;
                }
            }
            require(!isDuplicate, "Caller has already polled the vote.");
            airlineVotes[airline].push(msg.sender);
            //Atlease 50% multi party consensus
            if (airlineVotes[airline].length == M) {
                airlineVotes[airline] = new address[](0); 
                fsDataContract.registerAirline(airline, name, false);
                emit AirlineRegistrationStatus(true, 0);
            }
            else
                emit AirlineRegistrationStatus(false, M.sub(airlineVotes[airline].length));
        }
    }

    function getAirline (address airline) 
        requireIsOperational
        external
        view
        returns (string memory name, bool registered, bool paidFee)
    {
        return fsDataContract.getAirline(airline);
    }

    // function isRegistrationFeePaid () public view returns(bool) {
    //    return fsDataContract.isRegistrationFeePaid(msg.sender);
    // }
    

    function votesPolledForConsensus () 
        requireIsOperational
        public view returns(uint) 
    {
        return airlineVotes[msg.sender].length;    
    }

    function payAirlineRegistrationFee()
        requireIsOperational
        requireAirlineRegistered
        paidEnough(AIRLINE_REGISTRATION_FEE)
        returnExtraAmout(AIRLINE_REGISTRATION_FEE)
        public
        payable
    {
        address payable contactAddress = address(uint160(address(fsDataContract)));
        contactAddress.transfer(msg.value);
        fsDataContract.paidAirlineRegistrationFee(msg.sender);
    }

    function buyInsurance(address airline, string memory flightNumber, uint departureTime)
        requireIsOperational
        amountExceedsInsuranceCap
        public
        payable
    {
        bytes32 flightKey = getFlightKey(airline, flightNumber, departureTime);
        fsDataContract.buyInsurance(flightKey, flightNumber, msg.sender, msg.value);
        address payable contactAddress = address(uint160(address(fsDataContract)));
        contactAddress.transfer(msg.value);
    }

    function getInsurance (uint insId) 
        requireIsOperational
        external
        view
        returns (uint id, address passenger, string memory state, string memory flightNumber, uint amount)
    {
        
        return fsDataContract.getInsurance(insId);
    }

    function getInsureeCreditAmount () 
        requireIsOperational
        external view returns(uint) 
    {
        return fsDataContract.getInsureeCreditAmount(msg.sender);
    }


   /**
    * @dev Register a future flight for insuring.
    *
    */  
    function registerFlight(string calldata flightNumber, uint departureTime) 
        requireIsOperational 
        requireAirlineRegistered
        requirePaidRegistrationFee
        external 
    {
        fsDataContract.registerFlight(msg.sender, flightNumber, departureTime);
        emit FlightRegistered();
    }

    function getFlight (uint flightId) 
        requireIsOperational
        public
        view
        returns (uint id, address airline, string memory flightNumber, uint statusCode, uint departureTime)
    {
        return fsDataContract.getFlight(flightId);
    }
    
   /**
    * @dev Called after oracle has updated flight status
    *
    */  
    function processFlightStatus(address airline, string memory flight, uint256 timestamp, uint8 statusCode)
        requireIsOperational
        public
    {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        fsDataContract.processFlightStatus(flightKey, statusCode);
        if(statusCode == STATUS_CODE_LATE_AIRLINE) {
            uint[] memory insurees = fsDataContract.getInsurees(flightKey);
            for(uint index = 0; index < insurees.length; index++){
                uint paidAmount = fsDataContract.getInsuranceAmount(insurees[index]);
                fsDataContract.creditInsuree(insurees[index], paidAmount.mul(3).div(2));
            }
        }
    }

    function payInsuree(address insuree)
        requireIsOperational
        public
        payable
    {
        fsDataContract.payInsuree(insuree);
    }


    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus
                        (
                            address airline,
                            string calldata flight,
                            uint256 timestamp                            
                        )
                        requireIsOperational
                        external
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        oracleResponses[key] = ResponseInfo({
                                                requester: msg.sender,
                                                isOpen: true
                                            });

        emit OracleRequest(index, airline, flight, timestamp);
    } 


// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;    

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;

    event OracleRegistered(uint8[3] indexes);


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;        
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);


    // Register an oracle with the contract
    function registerOracle
                            (
                            )
                            requireIsOperational
                            external
                            payable
    {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
        emit OracleRegistered(indexes);
    }

    function getMyIndexes
                            (
                            )
                            requireIsOperational
                            view
                            external
                            returns(uint8[3] memory)
    {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }




    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse
                        (
                            uint8 index,
                            address airline,
                            string calldata flight,
                            uint256 timestamp,
                            uint8 statusCode
                        )
                        requireIsOperational
                        external
    {
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp)); 
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            oracleResponses[key].isOpen = false;
            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }


    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        public
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes
                            (                       
                                address account         
                            )
                            internal
                            returns(uint8[3] memory)
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex
                            (
                                address account
                            )
                            internal
                            returns (uint8)
    {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

    function () external payable {

    }

} 

interface FlightSuretyData {
    function registerAirline(address airline, string calldata name, bool paidFunds) external;
    function getAirline (address airline) external view returns (string memory name, bool registered, bool paidFee);
    function registerFlight(address airline, string calldata flightNumber, uint departureTime) external;
    function getFlight (uint flightId) external view returns (uint id, address airline, string memory flightNumber, uint statusCode, uint departureTime);
    function totalRegisteredAirlines() external view returns (uint);
    function isAirLineRegistered(address airline) external view returns (bool);
    function isRegistrationFeePaid(address airline) external view returns (bool);
    function paidAirlineRegistrationFee(address airline) external;
    function processFlightStatus(bytes32 flightKey, uint8 status)  external;
    function getInsurees(bytes32 flightKey) external view returns(uint[] memory);
    function getInsuranceAmount(uint insuranceId) external view returns(uint) ;
    function buyInsurance(bytes32 flightKey, string calldata flightNumber, address passenger, uint amountPaid) external;
    function getInsurance (uint insId) external view returns (uint id, address passenger, string memory state, string memory flightNumber, uint amount);
    function creditInsuree(uint _insuranceId, uint _creditAmount) external;
    function getInsureeCreditAmount (address insuree) external view returns(uint);
    function payInsuree(address insuree) external;
    function setOperatingStatus (bool mode) external;
}


