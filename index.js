import { exit } from "process"
import fs from "fs"
import { loadForbiddenWords , convertToHTML, replaceHTMLSymbols, spaceHTML, removeForbiddenWords} from "./pdf_propostas.js";
import proposal_links from "./proposals_links.json" assert { type: 'json' }

//create sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

// have to copy the function from the other .js file because of socket cringes
async function convertPDFtoHTML(pdfURL, outputFilename, forbidden_words) {
  return new Promise((resolve, reject) => {
   fetch(pdfURL, {
    method: 'GET',
 
  }).then(response => {
    response.arrayBuffer().then(buffer => {
      const pdfBuffer = Buffer.from(buffer);
      //delete the foribidden words from the pdfBuffer

      console.log("Writing downloaded PDF file to " + outputFilename + "...");
      fs.writeFileSync(outputFilename, pdfBuffer);
      convertToHTML(outputFilename)
      .then(text => {
          //delete the <head> tag
          text = text.replace(/<head>[\s\S]*<\/head>/, "");
          //remove the forbidden words
          text = replaceHTMLSymbols(text);
          text = spaceHTML(text);
          text = removeForbiddenWords(text, forbidden_words);
          
          fs.unlinkSync(outputFilename);
          resolve(text);

          
      }
      ).catch(error => {
          console.log(error);
          reject(error);
      }
      )
  })
  })
  .catch(error => {
    console.log(error);
    reject(error);

  }
    
  )
})
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


async function processProjetosLei(projetosLei, forbidden_words) {
  let amountOfIndividualProposals = 0
  for (let i = 0; i < projetosLei.length; i++) {
    const projetoLei = projetosLei[i];
    console.log(`--- PROCESSING(${i+1} / ${projetosLei.length}) : ` + projetoLei["iniTitulo"])
    console.log("---- ID: " + projetoLei["iniId"])
    
    //deal with proposals from individual deputies later
    if(!projetoLei["iniAutorGruposParlamentares"]){
      amountOfIndividualProposals++
      return
    }
   

    const votacaoGeneral = projetoLei["iniEventos"]["pt_gov_ar_objectos_iniciativas_EventosOut"]
    .filter(evento => evento["codigoFase"] === '250')
    let votacaoGeneralObj = null
    if(votacaoGeneral.length > 0) {
      if(votacaoGeneral[votacaoGeneral.length - 1]["votacao"] != undefined) 
        votacaoGeneralObj = votacaoGeneral[votacaoGeneral.length - 1]["votacao"]["pt_gov_ar_objectos_VotacaoOut"]
      else{
        console.log("--------  Warning: Found votacao generalidade mas nenhuma Votacao -------------")
        console.log(votacaoGeneral)
      }
        
    }

    const votacaoEspecialidade = projetoLei["iniEventos"]["pt_gov_ar_objectos_iniciativas_EventosOut"]
    .filter(evento => evento["codigoFase"] === '320')
    let votacaoEspecialidadeObj = null

    if(votacaoEspecialidade.length > 0) {
      if(votacaoEspecialidade[votacaoEspecialidade.length - 1]["votacao"] != undefined)
          votacaoEspecialidadeObj = votacaoEspecialidade[votacaoEspecialidade.length - 1]["votacao"]["pt_gov_ar_objectos_VotacaoOut"]
      else{
          console.log("--------  Warning: Found votacao especialidade but no Votacao -------------")
          console.log(votacaoEspecialidade)
        }
    }


    const voteDate = votacaoGeneralObj["data"]
    const legislatura = projetoLei["iniLeg"]
    const sourceId = projetoLei["iniId"]
    const grupo_parlamentar_proposal = projetoLei["iniAutorGruposParlamentares"]["pt_gov_ar_objectos_AutoresGruposParlamentaresOut"]["GP"]
    const proposalTitle = projetoLei["iniTitulo"]
    const proposalLink = projetoLei["iniLinkTexto"]
    
    const proposalResult = determineProposalResult(votacaoGeneralObj, votacaoEspecialidadeObj)
    const outputFilename = `download_${sourceId}.pdf`
    //convert the pdf to html and make the post request to store the data in the database
    await sleep(5000)
    convertPDFtoHTML(proposalLink, outputFilename, forbidden_words).then((html) => {
      const proposalTextHTML = html
      let finalData = {
        "voteDate": voteDate,
        "legislatura": legislatura,
        "sourceId": sourceId,
        "proposingPartyAcronym": grupo_parlamentar_proposal,
        "proposalTitle": proposalTitle,
        "fullProposalTextLink": proposalLink,
        "proposalTextHTML" : proposalTextHTML,
        "proposalResult" : proposalResult,
        "votingResultGenerality" : generateVotingBlocks(votacaoGeneralObj),
        "votingResultSpeciality" : generateVotingBlocks(votacaoEspecialidadeObj)

      }
      
      //delete the pdf file
      fs.unlinkSync(outputFilename)
    
      //make the post request to store the data in the database
      fetch(`http://0.0.0.0:8080/proposal/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalData),
        
      }).then(response => {
        if(!response.ok) {
          console.log("This proposal is already stored in the database!")


        }else{
          console.log(`Proposal ${sourceId} stored in the database successfully!`)
        }
    
      }) 
      .catch((error) => {
        console.error('Error:', error);
      });
    

      }).catch((err) => {
        console.log(err)
      })


}


  console.log("Amount of individual proposals: " + amountOfIndividualProposals)
}


async function processLegislature(leg_link, leg_arg) {
  const response = await fetch(leg_link);
  const jsonData = await response.json();
  const iniciativasData = jsonData["ArrayOfPt_gov_ar_objectos_iniciativas_DetalhePesquisaIniciativasOut"]["pt_gov_ar_objectos_iniciativas_DetalhePesquisaIniciativasOut"]

  let projetosLei = iniciativasData.filter(iniciativa => iniciativa["iniDescTipo"] === 'Projeto de Lei');   
  //filter projetosLei for iniciativas where the array["iniEventos"]["pt_gov_ar_objectos_iniciativas_EventosOut"] have an element with codigoFase == '250'

  projetosLei = projetosLei.filter(iniciativa => Array.isArray(iniciativa["iniEventos"]["pt_gov_ar_objectos_iniciativas_EventosOut"])
   && iniciativa["iniEventos"]["pt_gov_ar_objectos_iniciativas_EventosOut"].some(evento => evento["codigoFase"] === '250'));

  console.log("Amount of projetos-lei: " + projetosLei.length)
  
  const forbidden_words = await loadForbiddenWords(leg_arg)
  await processProjetosLei(projetosLei, forbidden_words)

 
}

//read the argument passed to the script
const leg_arg = process.argv[2]
if(!leg_arg){

  console.log("--- Please pass the legislature number as an argument to the script!! ---")
  exit(1)
}
//read the corresponding link from proposals_links.json
const leg_link = proposal_links["legislaturas"][leg_arg]

processLegislature(leg_link, leg_arg);