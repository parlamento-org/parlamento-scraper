const legislatura_15_link = "https://app.parlamento.pt/webutils/docs/doc.txt?path=6148523063446f764c324679626d56304c3239775a57356b595852684c3052685a47397a51574a6c636e52766379394a626d6c6a6157463061585a6863793959566955794d45786c5a326c7a6247463064584a684c306c7561574e7059585270646d467a57465a66616e4e76626935306548513d&fich=IniciativasXV_json.txt&Inline=true"


function determineProposalResult(votacaoGeneralidadeObj, votacaoEspecialidadeObj ) {
  let proposalResult = "ApprovedInGenerality"
  if (votacaoEspecialidadeObj) {
    if(votacaoEspecialidadeObj["resultado"] === "Rejeitdo") {
      proposalResult = "RejectedInSpeciality"
    }else{
      proposalResult = "ApprovedInSpeciality"
    }
  }else if(votacaoGeneralidadeObj["resultado"] === "Rejeitado") {
    proposalResult = "RejectedInGenerality"

  }


  return proposalResult
}

function containsNumbers(str) {
  return /[0-9]/.test(str);
}


function votingBlockByOrientation(orientation, votacaoObj) {
  let nonUnanimousParties = []

  let votingBlocks = []
  for (let i = 0; i < votacaoObj.length; i++) {
    let votacaoIndividual = votacaoObj[i].replaceAll(' ','')
    

    //remove all numbers from the string
    const politicalPartyAcronym = votacaoIndividual.replace(/[0-9]/g, '')
    // guarantees we dont process deputy names
    if (politicalPartyAcronym.length > 7) continue

    let votingBlock = {
      "isUninamousWithinParty": true,
      "politicalPartyAcronym": politicalPartyAcronym,
      "votingOrientation": orientation,

    }

    if(nonUnanimousParties.includes(politicalPartyAcronym)) {
      votingBlock["isUninamousWithinParty"] = false
    }else if(containsNumbers(votacaoIndividual)) {
      votingBlock["isUninamousWithinParty"] = false
      nonUnanimousParties.push(politicalPartyAcronym)
      votingBlock["numberOfDeputies"] = parseInt(votacaoIndividual.replace(/[a-zA-Z]/g, ''))

    }

    votingBlocks.push(votingBlock)

  
  }

  return votingBlocks
}

function splitBetweenKeywords(inputString) {
  const keywords = ['A Favor', 'Contra', 'Abstenção'];
  let splits = [];
  let foundKeywords = [];

  let startIndex = 0;
  for (const keyword of keywords) {
    const keywordIndex = inputString.indexOf(keyword, startIndex);
    if (keywordIndex !== -1) {
      const split = inputString.substring(startIndex, keywordIndex).trim();
      foundKeywords.push(keyword);
      splits.push(split);
      startIndex = keywordIndex + keyword.length;
    }
  }

  const lastSplit = inputString.substring(startIndex).trim();
  splits.push(lastSplit);
  splits = splits.filter(split => split !== '');

  let votingKeywords = []
  for (let i = 0; i < foundKeywords.length; i++) {
    votingKeywords.push({
      "vote": foundKeywords[i],
      "string": splits[i]
    })
  }

  return votingKeywords;
}

function generateVotingBlocks(votacaoObj) {
  if(votacaoObj === null || Array.isArray(votacaoObj)) return null
  if(votacaoObj["unanime"]) {
    return {
      "isUninamous" : true
    }
  }

  
  console.log(votacaoObj)

  let votacaoObjString = votacaoObj["detalhe"]
  votacaoObjString = votacaoObjString.replaceAll('<BR>','')
  votacaoObjString = votacaoObjString.replaceAll(':','')
  votacaoObjString = votacaoObjString.replaceAll('-','')
  votacaoObjString = votacaoObjString.replaceAll('<I>','')
  votacaoObjString = votacaoObjString.replaceAll('</I>','')
 
  let votingFinalObj = {
    "isUninamous" : false,
   
  }

  let votingBlocks = []

  //split the string so that we have three strings with the string that comes after "A Favor:", "Contra:" and "Abstenção:
  const splits = splitBetweenKeywords(votacaoObjString);


  let votacaoAFavor = splits.filter(split => split["vote"] === "A Favor")
  if(votacaoAFavor.length > 0) votacaoAFavor = votacaoAFavor[0]["string"].split(',')
  
  let votacaoContra = splits.filter(split => split["vote"] === "Contra")
  if(votacaoContra.length > 0) votacaoContra = votacaoContra[0]["string"].split(',')

  let votacaoAbstencao = splits.filter(split => split["vote"] === "Abstenção")
  if(votacaoAbstencao.length > 0) votacaoAbstencao = votacaoAbstencao[0]["string"].split(',')
  


  votingBlocks.push(...votingBlockByOrientation("InFavor", votacaoAFavor))
  votingBlocks.push(...votingBlockByOrientation("Against", votacaoContra))
  votingBlocks.push(...votingBlockByOrientation("Abstaining", votacaoAbstencao))


  votingFinalObj["votingBlocks"] = votingBlocks
  return votingFinalObj

}


async function processLegislature(leg_link) {
  const response = await fetch(leg_link);
  const jsonData = await response.json();
  const iniciativasData = jsonData["ArrayOfPt_gov_ar_objectos_iniciativas_DetalhePesquisaIniciativasOut"]["pt_gov_ar_objectos_iniciativas_DetalhePesquisaIniciativasOut"]

  let projetosLei = iniciativasData.filter(iniciativa => iniciativa["iniDescTipo"] === 'Projeto de Lei');   
  //filter projetosLei for iniciativas where the array["iniEventos"]["pt_gov_ar_objectos_iniciativas_EventosOut"] have an element with codigoFase == '250'

  projetosLei = projetosLei.filter(iniciativa => Array.isArray(iniciativa["iniEventos"]["pt_gov_ar_objectos_iniciativas_EventosOut"])
   && iniciativa["iniEventos"]["pt_gov_ar_objectos_iniciativas_EventosOut"].some(evento => evento["codigoFase"] === '250'));

  let amountOfIndividualProposals = 0
  projetosLei.forEach(projetoLei => {
    console.log("--- PROCESSING: " + projetoLei["iniTitulo"])
    console.log("---- ID: " + projetoLei["iniId"])
    
    //deal with proposals from individual deputies later
    if(!projetoLei["iniAutorGruposParlamentares"]){
      amountOfIndividualProposals++
      return
    }
   

    const votacaoGeneralObj = projetoLei["iniEventos"]["pt_gov_ar_objectos_iniciativas_EventosOut"]
    .filter(evento => evento["codigoFase"] === '250')[0]["votacao"]["pt_gov_ar_objectos_VotacaoOut"]

    const votacaoEspecialidade = projetoLei["iniEventos"]["pt_gov_ar_objectos_iniciativas_EventosOut"]
    .filter(evento => evento["codigoFase"] === '320')
    let votacaoEspecialidadeObj = null

    if(votacaoEspecialidade.length > 0) {
      votacaoEspecialidadeObj = votacaoEspecialidade[0]["votacao"]["pt_gov_ar_objectos_VotacaoOut"]

    }


    const voteDate = votacaoGeneralObj["data"]
    const legislatura = projetoLei["iniLeg"]
    const sourceId = projetoLei["iniId"]
    const grupo_parlamentar_proposal = projetoLei["iniAutorGruposParlamentares"]["pt_gov_ar_objectos_AutoresGruposParlamentaresOut"]["GP"]
    const proposalTitle = projetoLei["iniTitulo"]
    const proposalLink = projetoLei["iniLinkTexto"]
    
    const proposalResult = determineProposalResult(votacaoGeneralObj, votacaoEspecialidadeObj)



    let finalData = {
      "voteDate": voteDate,
      "legislatura": legislatura,
      "sourceId": sourceId,
      "proposingPartyAcronym": grupo_parlamentar_proposal,
      "proposalTitle": proposalTitle,
      "fullProposalTextLink": proposalLink,
      "proposalResult" : proposalResult,
      "votingResultGenerality" : generateVotingBlocks(votacaoGeneralObj),
      "votingResultSpeciality" : generateVotingBlocks(votacaoEspecialidadeObj)

  }

  console.log(finalData)
  console.log(finalData["votingResultGenerality"])

  //make the post request to store the data in the database
  fetch('http://0.0.0.0:8080/proposal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(finalData),
    
  }).then(response => {
    if(!response.ok) {
      console.log("This proposal is already stored in the database!")
    }
 
  }) 
  .catch((error) => {
    console.error('Error:', error);
  });



}

  )

  console.log("Amount of individual proposals: " + amountOfIndividualProposals)
}


processLegislature(legislatura_15_link);