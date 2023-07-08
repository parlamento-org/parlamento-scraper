import { loadForbiddenWords ,convertToHTML, replaceHTMLSymbols, spaceHTML, removeForbiddenWords} from "./pdf_propostas.js";
import fs from "fs";

const foribiddenWords = await loadForbiddenWords("XV");

async function getAllProposals() {
  const response = await fetch(`http://0.0.0.0:8080/proposal/`);
  const jsonData = await response.json();
  return jsonData["proposals"];

}

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
  

async function updateProposal(proposalObj) {
    const proposalHTML = proposalObj.proposalTextHTML;
    const sourceId = proposalObj.sourceId;
    if(proposalHTML != null){
        console.log(`Proposal ${sourceId} already has HTML!`);
        return
    } 

    const proposalPDFLink = proposalObj.fullProposalTextLink;
    await convertPDFtoHTML(proposalPDFLink, `download_${sourceId}.pdf`, foribiddenWords).then((html) => {
        const updateBodyJSON = {
            "proposalTextHTML": html
        }
        fetch(`http://0.0.0.0:8080/proposal/${sourceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateBodyJSON),
        }).then(response => {
            if(!response.ok) {
                console.log("This proposal is already stored in the database!")
            }else{
                console.log(`Proposal ${sourceId} stored in the database successfully!`)
            }
        }
        ).catch((error) => {
            console.error('Error:', error);
        })
        }).catch((err) => { console.log(err) }
        );


}
  
async function updateAllProposals() {
    const allProposals = await getAllProposals();
    for(let i = 0; i < allProposals.length; i++) {
        console.log(`---- Updating proposal ${i + 1} / ${allProposals.length} ----`);
        await updateProposal(allProposals[i]);
    }
}

updateAllProposals();