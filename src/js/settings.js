const remote = require('electron').remote;
const fs = require('fs')

window.onload = function(e){
  document.getElementById("cancel-btn").addEventListener("click", function (e) {
    var window = remote.getCurrentWindow();
    window.close(); 
  });

  document.getElementById("submit-btn").addEventListener("click", function (e) {
    var configmap = {
      "dndurl": document.getElementById('dndurl').value,
      "username": document.getElementById('username').value,
      "password": document.getElementById('password').value
    }

    var homedir = remote.app.getPath("home");
    fs.writeFileSync(homedir+"/.dndesktopconfig.json", 
      JSON.stringify(configmap),
      "utf-8");

    var window = remote.getCurrentWindow();
    window.close();
  });
}