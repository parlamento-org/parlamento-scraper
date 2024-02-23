//request the online pdf and print out its contents
import fs from 'fs';
import pdf2html from 'pdf2html';
import forbidden_words from "./forbidden_words.json" assert { type: 'json' }
import html_symbols_dict from "./html_symbols.json" assert { type: 'json' }

const forbidden_array = await loadForbiddenWords("XV");


async function convertToHTML(pdfPath){
    const html = await pdf2html.html(pdfPath);
    
    return html;
}

async function loadForbiddenWords(legislature){
    const forbidden_link = forbidden_words["legislatura"][legislature];
   
   
    const response = await fetch(forbidden_link, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    })
    const jsonData = await response.json();
    const grupos_parlamentares = jsonData["Legislatura"]["GruposParlamentares"]["pt_gov_ar_objectos_GPOut"];
    const deputados = jsonData["Legislatura"]["Deputados"]["pt_ar_wsgode_objectos_DadosDeputadoSearch"];
    const nome_deputados_completo = deputados.map((deputado) => deputado["depNomeCompleto"]);
    const nome_deputados_parlamentar = deputados.map((deputado) => deputado["depNomeParlamentar"]);
    const siglas_partidos = grupos_parlamentares.map((grupo_parlamentar) => grupo_parlamentar["sigla"]);
    const nome_partidos = grupos_parlamentares.map((grupo_parlamentar) => grupo_parlamentar["nome"]);

    
    let forbidden_array = siglas_partidos.concat(nome_partidos, nome_deputados_completo, nome_deputados_parlamentar);
    //additional special cases
    forbidden_array.push("Deputado Único", "Deputada Única", "Deputado", "Deputada", "Deputados", "Deputadas", "Deputado(a)", "Deputados");
    forbidden_array = forbidden_array.map((word) => word.toLowerCase());
    console.log(forbidden_array);
    return forbidden_array;

}

function replaceHTMLSymbols(html){
    //find and replace all the html symbols with their respective characters
    //iterate through the dictionary
    for (const [key, value] of Object.entries(html_symbols_dict)) {
        const regex = new RegExp(key, "g");
        html = html.replace(regex, value);
    }
    return html;

}

function spaceHTML(html){
    //add a space before and after each tag
    const regex = /(<\/?\w+>)/g;
    const spaced_html = html.replace(regex, " $1 ");
    return spaced_html;
}

function removeForbiddenWords(text, forbidden_words){
    // regex matches the words with a space before and after

    const regex = new RegExp("[\n\b\r,.:; ]" + forbidden_words.join("[\n\b\r,:;. ]|[\n\b\r,;:. ]") + "[\n\b\r,:;. ]", "gi");
    
    const text_without_forbidden_words = text.replace(regex, " <censored> ");

    //remove the <p> tag that starts with "Projeto de Lei"
    const regex_projeto_lei = new RegExp("<p> Projeto de Lei .*?</p>", "gis");
    const text_without_projeto_lei = text_without_forbidden_words.replace(regex_projeto_lei, " <censored> ");

    return text_without_projeto_lei;
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
  



//request local database for a proposal
function requestProposal(proposalId) {
fetch(`http://0.0.0.0:8080/proposal/${proposalId}`, {
    method: 'GET',
    headers: {
        'Content-Type': 'application/json',
    },
}).then(response => response.json())
    .then(data => {
        console.log(data)
        // Example usage:
        const pdfUrl = data["fullProposalTextLink"];
        const destinationPath = './downloaded.pdf';
        convertPDFtoHTML(pdfUrl, destinationPath, forbidden_array)
        .then((html) => {
            fs.writeFileSync("./downloaded.html", html);
            console.log("PDF downloaded successfully!");
        }
        )
       

    }
)
    
}

export {convertPDFtoHTML, loadForbiddenWords, convertToHTML, replaceHTMLSymbols, spaceHTML, removeForbiddenWords};