
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async() => {

    let result = null;

    let contract = new Contract('localhost', () => {

        let navigations = ["res-contract", "res-airlines", "res-flights", "res-insurance"].map( item => {
            return DOM.elid(item);
        });
        let formContainers = ["res-contract-form", "res-airlines-form", "res-flights-form", "res-insurance-form"].map( item => {
            return DOM.elid(item);
        });
        let displayResult = DOM.elid("display-result");
        navigations.forEach((navItem, index, arr) => {
            navItem.addEventListener("click", () => {
                arr.forEach((item, idx, array) => {
                    item.classList.remove("active");
                    formContainers[idx].style.display = "none";
                });
                navItem.classList.add("active");
                formContainers[index].style.display = "block";
                displayResult.innerHTML = "";
            });
        });

        window.onload = async (e) => { 
            let operationalState = DOM.elid("operationalState");
            let result = await contract.isOperational();
            operationalState.innerHTML = result ? "Contract is in operational / enabled state" : "Contract is in paused / disabled state";
        }

        DOM.elid("toggleStatus").addEventListener("click", async () => {
            let operationalState = DOM.elid("operationalState");
            let err, result;
            try {
                result = await contract.toggleOperationState();
                operationalState.innerHTML = result ? "Contract is in operational / enabled state" : "Contract is in paused / disabled state";
            } catch (e) {
                err = e;
            } finally {
                display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: err, value: result} ]);

            }
        });

        DOM.elid("registerAirline").addEventListener("click", async () => {
            let name = DOM.elid("airlineName").value;
            let airline = DOM.elid("airlineAddress").value;
            let from = DOM.elid("registerFrom").value;
            let err, result, label, info;
            let code = -1;
            try {
                    await contract.registerAirline(airline, name, from, 
                    (registered, votesLeft) => {
                    if(registered)
                    {
                        label = "Success";
                        result = `New Airline ${name} registered successfully`;   
                        info =  "New Airline registered";
                    }else{
                        label = "Not Registered";
                        result = `Airline ${name} is not registered yet. To register it ${votesLeft} more vote(s) needed`;
                        info = 'Airline is not registered'
                    }

                    if(code >= 0)
                        return
                    code = votesLeft;


                    display("Airline Status", info,[ { label: label, error: err, value: result } ]);
                    
                });
                
            } catch(e){
                label = "Error!!!";
                err = e;
            } finally {
                display("Airline Status", info,[ { label: label, error: err, value: result } ]);
            }
        });

        DOM.elid("payFee").addEventListener("click", async () => {
            let from = DOM.elid("payFeeFrom").value;
            let regFee = DOM.elid("registrationFee").value;
            let err, result, label;
            try {
                await contract.payAirlineRegistrationFee(from, regFee);
                label = "Success";
                result = "Registration fee paid";
            } catch(e){
                label = "Error!!!";
                err = e;
            } finally {
                display("Registration Fee Status", "Paid registration fee successfully", [ {label: label, error: err, value: result} ] );
            }
        });

        DOM.elid("registerFlight").addEventListener("click", async () => {
            let airline = DOM.elid("flightAirlineAddress").value;
            let flightNumber = DOM.elid("flightNumber").value;
            let departureTime = DOM.elid("flightDepartureTime").value;

            let err, result, label;
            try {
                await contract.registerFlight(airline, flightNumber, departureTime);
                label = "Success";
                result = `Flight ${flightNumber} registered successfully`;
            } catch (e) {
                err = e;
                label = "Failure";
            } finally {
                display('Flight Status', 'Registered new flight', [ { label: label, error: err, value: result} ]);
            }
        });

        DOM.elid("sumitToOracle").addEventListener("click", async () => {
            let fId = DOM.elid("fId").value;
            let err, result, status;
            let code = -1;
            try {
                result = 'Fetching...';
                await contract.fetchFlightStatus(fId, (statusCode) => {

                    if(statusCode == 0)
                        status = 'Unknown';
                    else if(statusCode == 10)
                        status = 'On time';
                    else if(statusCode == 20)
                        status = 'Late due to airline';
                    else if(statusCode == 30)
                        status = 'Late due to weather conditions';
                    else if(statusCode== 40)
                        status = 'Late due to technical issues';
                    else if(statusCode == 50)
                        status = 'Late due to other reason';

                    if(code >= 0)
                        return
                    code = statusCode;

                    display('Flight Status Update', 'Updated flight status received from Oracle server.',
                    [
                        { label: "Status", error: err, value: status },
                    ]);
                });
            } catch (e) {
                err = e;
            } finally {
                display('Flight Status Update', 'Updated flight status received from Oracle server.', [{ label: 'Flight Current Status', error: err, value: result}]);

            }
        });

        DOM.elid("getFlight").addEventListener("click", async () => {
            let flightId = DOM.elid("flightId").value;

            let err, result, label, status;
            let reverted = false;
            try {
                result = await contract.getFlight(flightId);
                label = "Success";
                let code = result.statusCode
                if(code == 0)
                    status = 'Unknown';
                else if(code == 10)
                    status = 'On time';
                else if(code == 20)
                    status = 'Late due to airline';
                else if(code == 30)
                    status = 'Late due to weather conditions';
                else if(code== 40)
                    status = 'Late due to technical issues';
                else if(code == 50)
                    status = 'Late due to other reason';
            } catch (e) {
                err = e;
                label = "Error!!!";
                reverted = true;
            } finally {
                if(reverted)
                    display('Flight Status', 'Error getting flight information', [ { label: label, error: err, value: result} ]);
                else
                {
                    display('Flight Information', 'Get flight Information',
                    [
                        { label: "Airline Address", error: err, value: result.airline },
                        { label: "Flight Number", error: err, value: result.flightNumber },
                        { label: "Status", error: err, value: status },
                        { label: "Departure", error: err, value: result.departureTime },
                    ]);
                }
            }
        });

        DOM.elid("buyInsurance").addEventListener("click", async () => {
            let flightId = DOM.elid("insuFlightId").value;
            let amount = DOM.elid("insuAmount").value;
            let fromPassenger = DOM.elid("fromPassenger").value;

            let err, result, label;
            try {
                await contract.buyInsurance(fromPassenger, flightId, amount);
                label = "Success";
                result = `${fromPassenger} bought an Insurance`;
            } catch (e) {
                err = e;
                label = "Error!!!";
            } finally {
                display('Insurance Status', 'Register new Insurance', [ { label: label, error: err, value: result} ]);
            }
        });

        DOM.elid("getInsurance").addEventListener("click", async () => {
            let insuranceId = DOM.elid("insuranceId").value;

            let err, result, label;
            let reverted = false;
            try {
                result = await contract.getInsurance(insuranceId);
                label = "Success";
            } catch (e) {
                err = e;
                reverted = true;
                label = "Error!!!";
            } finally {
                if(reverted)
                    display('Insurance Status', 'Error getting insurance information', [ { label: label, error: err, value: result} ]);
                else
                {
                    display('Insurance information', 'Get insurance information',
                    [
                        { label: "Passenger", error: err, value: result.passenger },
                        { label: "State", error: err, value: result.state },
                        { label: "Flight Number", error: err, value: result.flightNumber },
                        { label: "Amount", error: err, value: result.amount },
                    ]);
                }
            }
        });

        DOM.elid('passendgerCreditedAmount').addEventListener('click', async () => {
            let passengerId = DOM.elid("passengerId").value;

            let err, result, label;
            label = "Credited Amount";
            try {
                result = await contract.getInsureeCreditAmount(passengerId);
            } catch (e) {
                err = e;
                label = "Error!!!";
                console.log(e);
            } finally {
                display('Credited Amount Information', 'Get credited amount detail', [ { label: label, error: err, value: result} ]);
            }
        });

        DOM.elid('payInsureeAmount').addEventListener('click', async () => {
            let passengerId = DOM.elid("payeePassengerId").value;
            let err, result, label;

            try {
                result = await contract.payInsuree(passengerId);
                label = "Success";
            } catch (e) {
                err = e;
                label = "Error!!!";
                console.log(e);
            } finally {
                display('Withdraw Credited Amount', 'Transfers the amount specified to given address', [ { label: label, error: err, value: "Amount Withdrawn"} ]);
            }
        });
    
    });
    

})();


function display(title, description, results) {
    let displayDiv = DOM.elid("display-result");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}







