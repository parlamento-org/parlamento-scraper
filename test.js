 const text_without_forbidden_words = "<p> Projeto de Lei n.º 832/XV/1.º  \n </p>"
 
 //remove the <p> tag that starts with "Projeto de Lei"
 const regex_projeto_lei = new RegExp("<p> Projeto de Lei .*?</p>", "gis");
 const text_without_projeto_lei = text_without_forbidden_words.replace(regex_projeto_lei, " <censored> ");

console.log(text_without_projeto_lei);
