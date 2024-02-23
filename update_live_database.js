async function getAllProposals() {
    const response = await fetch(`http://0.0.0.0:8080/proposal/`);
    const jsonData = await response.json();
    
    return jsonData["proposals"];
}

function fillUpLiveDatabase(proposals){
    console.log("Filling up the live database...");
    console.log(proposals);
    for(let i = 0; i < proposals.length; i++){
        const proposal = proposals[i];
        const sourceId = proposal["sourceId"];
        console.log("PROCESSING: "  + proposal["proposalTitle"]);
    const finalData = {
            "voteDate": proposal["voteDate"],
            "legislatura": proposal["legislatura"],
            "sourceId": proposal["sourceId"],
            "proposingPartyAcronym": proposal["proposingParty"]["partyAcronym"],
            "proposalTitle": proposal["proposalTitle"],
            "fullProposalTextLink": proposal["fullProposalTextLink"],
            "proposalTextHTML" : proposal["proposalTextHTML"],
            "proposalResult" : proposal["proposalResult"],
            "votingResultGenerality" : proposal["votingResultGenerality"],
            "votingResultSpeciality" : proposal["votingResultSpeciality"],
    
          }
        
    
      //make the post request to store the data in the database
      makeRequest(finalData, sourceId);
    

      }
}

async function makeRequest(finalData, sourceId){
  fetch(`http://parlamento-dev-api.fly.dev/proposal/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(finalData),
    
  }).then( async response =>  {
    if(!response.ok) {
      if(response.status == 404){
        console.log("This proposal is already stored in the database!")
      }else{
        //retry the fetch after 5 seconds
        console.log("Retrying to store the proposal in the database...")
        await new Promise(r => setTimeout(r, 5000));
        makeRequest(finalData, sourceId);

      }

    }else{
      console.log(`Proposal ${sourceId} stored in the database successfully!`)
    }

  }) 
  .catch((error) => {
    console.error('Error:', error);
  });
}


fillUpLiveDatabase(await getAllProposals());

