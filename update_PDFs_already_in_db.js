import { loadForbiddenWords ,convertToHTML, replaceHTMLSymbols, spaceHTML, removeForbiddenWords} from "./pdf_propostas.js";
import fs from "fs";
import html_symbols_dict from "./html_symbols.json" assert { type: 'json' }

const foribiddenWords = await loadForbiddenWords("XV");

async function getAllProposals() {
  const response = await fetch(`http://0.0.0.0:8080/proposal/`);
  const jsonData = await response.json();
  return jsonData["proposals"];

}

async function getProposalById(id) {
  const response = await fetch(`http://0.0.0.0:8080/proposal/${id}`);
  const jsonData = await response.json();
  return jsonData;

}

function cleanString(input) {
    var output = "";
    //get all characters in html_symbols_dict
    var html_symbols = "";
    for (const [key, value] of Object.entries(html_symbols_dict)) {
        html_symbols += value;
    }
    for (var i=0; i<input.length; i++) {
        if (input.charCodeAt(i) <= 127 || html_symbols.includes(input.charAt(i))) {
            output += input.charAt(i);
        }
    }
    return output;
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
            text = cleanString(text);
            
            
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
  
async function updateProposalById(id) {
    console.log(`---- Updating proposal ${id} ----`);
    const proposal = await getProposalById(id);
    await updateProposal(proposal);

}

async function updateProposal(proposalObj) {
    const proposalHTML = proposalObj.proposalTextHTML;
    const sourceId = proposalObj.id;
    console.log(`Updating proposal ${sourceId}...`);
   

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

updateProposalById(62);