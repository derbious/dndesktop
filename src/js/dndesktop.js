const fs = require('fs')
const electron = require('electron');

const output_dir = electron.remote.app.getPath("userData"); 
const commentbox_file = output_dir+'/commentbox.txt';
const gameclock_file = output_dir+'/gameclock.txt';
const dmname_file = output_dir+'/dmname.txt';

const playing_clock_start = new Date('2017-11-10T02:00:00Z'); //When DnDonations is starting

var dndapi_endpoint;

var commentbox_write;

function pad(n) {
  return (n < 10) ? ("0" + n) : n;
}

function tailPad(pad, str) {
  return (str + pad).substring(0, pad.length);
}


// Reads the url from the textfile, and stores it
function setupApiEndpoint(){
  var homedir = electron.remote.app.getPath("home");
  dndapi_endpoint = fs.readFileSync(homedir+"/.dndesktopconfig.txt", "utf-8").replace(/\s/g,'');
}
//read password and get admin token
function setupAdminToken(){
  console.log(dndapi_endpoint);
  //First, read the password from the file
  homedir = electron.remote.app.getPath("home");
  pass = fs.readFileSync(homedir+"/.dndesktoppass.txt", 'utf-8').replace(/\W/g, '');
  // load the token
  var authreq = new XMLHttpRequest();
  authreq.onreadystatechange = function() {
    if (authreq.readyState == XMLHttpRequest.DONE) {
      if (authreq.status == 200) {
        // Store the token in local storage
        //console.log(xmlhttp.responseText);
        r = JSON.parse(authreq.responseText);
        sessionStorage.setItem('access_token', r['access_token']);
        refreshPlayerList();
        refreshDmInfo();
        refreshGraveyard();
      } else {
        console.log(authreq);
      }
    }
  };

  authreq.open("POST", "http://localhost:5000/auth");
  authreq.setRequestHeader('Content-Type', 'application/json');
  authreq.send('{"username": "admin", "password": "'+pass+'"}');
}


// Update the playing clock
function refreshPlayingClock() {
  var n = new Date();
  var diffMs = n - playing_clock_start;
  var diffHrs = Math.floor((diffMs % 86400000) / 3600000); // hours
  var diffMins = Math.floor(((diffMs % 86400000) % 3600000) / 60000); // minutes
  var clockstring = pad(diffHrs)+':'+pad(diffMins);
  document.getElementById('playclock').innerHTML = clockstring;
  fs.writeFileSync(gameclock_file, clockstring);
}

function killCharacter(char_id) {
  event.preventDefault();
  console.log('Killing character:', char_id);
  var token = sessionStorage.getItem('access_token');
  var killreq = new XMLHttpRequest();
  killreq.onreadystatechange = function() {
    if (killreq.readyState == XMLHttpRequest.DONE) {
      if (killreq.status == 201) {
        refreshDmInfo();
        refreshPlayerList();
        refreshGraveyard();
      }
    }
  }
  killreq.open("POST", "http://localhost:5000/characters/death/"+char_id);
  killreq.setRequestHeader('Authorization', 'JWT '+token);
  killreq.send();
}

//use token to update player list (playing)
function refreshPlayerList() {
  console.log('Refreshing player list.');
  var token = sessionStorage.getItem('access_token');
  var plreq = new XMLHttpRequest();
  plreq.onreadystatechange = function() {
    if (plreq.readyState == XMLHttpRequest.DONE) {
      if (plreq.status == 200) {
        // parse the response
        r = JSON.parse(plreq.responseText);
        nowDate = new Date();
        th = '';
        for(i=0; i<6; i++){
          th += '<tr><td width="5%"><p class="pheading">P'+(i+1)+'</p></td>';
          if(r['playing'][i] != null){
            th += '<td width="10%">'+r['playing'][i]['name']+'</td>';
            th += '<td width="20%">'+r['playing'][i]['race']+'</td>';
            th += '<td width="30%">'+r['playing'][i]['class']+'</td>';
            th += '<td width="5%">'+r['playing'][i]['num_resses']+'</td>';
            var startDate = new Date(r['playing'][i]['starttime']);
            var diffMs = nowDate - startDate;
            var diffHrs = Math.floor((diffMs % 86400000) / 3600000); // hours
            var diffMins = Math.floor(((diffMs % 86400000) % 3600000) / 60000); // minutes
            var timer = pad(diffHrs)+':'+pad(diffMins);
            th += '<td width="18">'+timer+'</td>';
            th += '<td width="12"><button class="btn" onclick="showResPage('+r['playing'][i]['id']+','+r['playing'][i]['num_resses']+');">res</button>';
            th += '<button class="btn" onclick="killCharacter('+r['playing'][i]['id']+');">kill</button></td>';
            var nameoutput = r['playing'][i]['name'];
            var classoutput = r['playing'][i]['class'];
            var timeoutput = timer;
          }else{
            // display add player dropdown
            th += '<td width="95%" colspan="6"><form><select id="entry-'+(i+1)+'">';
            for(j=0; j<r['waiting'].length; j++){
              th += '<option value="'+r['waiting'][j]['id']+'">';
              th += (j+1)+") "+r['waiting'][j]['name']+'</option>';
            }
            th += '</select>';
            th += '<button class="btn" id="add-'+(i+1)+'"';
            th += ' class="btn">Add</button></form></td>';
            var nameoutput = '';
            var classoutput = '';
            var timeoutput = '--:--';
          }
          th += '</tr>'
          fs.writeFileSync(output_dir+'/p'+(i+1)+'name.txt', nameoutput);
          fs.writeFileSync(output_dir+'/p'+(i+1)+'class.txt', classoutput);
          fs.writeFileSync(output_dir+'/p'+(i+1)+'time.txt', timeoutput);
        }
        document.getElementById("playingtable").innerHTML = th;
        for(i=0; i<6; i++) {
          // Add "add" button to pull players into the game
          if(r['playing'][i] == null) {
            document.getElementById("add-"+(i+1)).addEventListener('click', mkAddClickListener(i+1));
          }
        }
      } else {
        console.log(plreq);
      }
    }
  };

  plreq.open("GET", "http://localhost:5000/queue/");
  plreq.setRequestHeader('Content-Type', 'application/json');
  plreq.setRequestHeader('Authorization', 'JWT '+token);
  plreq.send();
}

function refreshGraveyard() {
  var token = sessionStorage.getItem('access_token');
  var gyreq = new XMLHttpRequest();
  gyreq.onreadystatechange = function() {
    if (gyreq.readyState == XMLHttpRequest.DONE) {
      if (gyreq.status == 200) {
        // parse the response
        r = JSON.parse(gyreq.responseText);
        var padding = Array(20).join(' ');
        output_txt = ''
        for(i=0; i<r.length; i++) {
          output_txt += tailPad(padding, r[i]['player']);
          output_txt += tailPad(padding, r[i]['name']);
          var hours = Math.floor(r[i]['seconds_alive'] / 3600);
          var mins = Math.floor((r[i]['seconds_alive'] % 3600) / 60);
          output_txt += pad(hours)+':'+pad(mins);
          output_txt += '\n';
        }
        fs.writeFileSync(output_dir+'/graveyard.txt', output_txt);
      }
    }
  }
  
  gyreq.open("GET", "http://localhost:5000/characters/graveyard/");
  gyreq.setRequestHeader('Content-Type', 'application/json');
  gyreq.setRequestHeader('Authorization', 'JWT '+token);
  gyreq.send();
}

function mkAddClickListener(row){
  return function(e){
    e.preventDefault();
    //console.log('Clicked add-', row);
    var charid = document.getElementById('entry-'+row).value; 
    // make a json call to start the char playing
    var token = sessionStorage.getItem('access_token');
    var spreq = new XMLHttpRequest();
    spreq.onreadystatechange = function() {
      if (spreq.readyState == XMLHttpRequest.DONE) {
        if (spreq.status == 201) {
          refreshPlayerList();
        }
      }
    };
    data = '{"seat_num": '+row+'}'
    spreq.open("POST", "http://localhost:5000/characters/startplay/"+charid);
    spreq.setRequestHeader('Content-Type', 'application/json');
    spreq.setRequestHeader('Authorization', 'JWT '+token);
    spreq.send(data);
  }
}

// write the status bar out 3 seconds after change
function updateStatusBar(event) {
  clearInterval(commentbox_write);
  commentbox_write = setTimeout(function() {
    var v = document.getElementById('commentbox').value;
    console.log('writing contents of box', v);
    fs.writeFileSync(commentbox_file, v);
  }, 3000);
}

// Show the res-character box.
function showResPage(id, num_resses) {
  //set the id and amount in the page.
  document.getElementById('resCharId').value = id;
  document.getElementById('resCharCost').value = 5 * Math.pow(2,num_resses);
  document.getElementById('resCharPage').style.display = 'block';
}

// submit res
function submitRes(event) {
  //Send the res to the server
  console.log('saved the res');
  var charid = document.getElementById('resCharId').value; 
  // make a json call to start the char playing
  var token = sessionStorage.getItem('access_token');
  var resreq = new XMLHttpRequest();
  resreq.onreadystatechange = function() {
    if (resreq.readyState == XMLHttpRequest.DONE) {
      if (resreq.status == 201) {
        document.getElementById('resCharPage').style.display = 'none';
        refreshPlayerList();
        refreshDmInfo();
      }
    }
  };

  var amt = document.getElementById('resCharCost').value;
  var payment = document.querySelector('input[name="payform"]:checked').value;
  var data = '{"donation": null}'
  if(document.getElementById('resCharPaying').checked){
    data = '{"donation": {"amt": '+amt+', "method": "'+payment+'"}}'
  }
  resreq.open("POST", "http://localhost:5000/characters/res/"+charid);
  resreq.setRequestHeader('Content-Type', 'application/json');
  resreq.setRequestHeader('Authorization', 'JWT '+token);
  resreq.send(data);
}

function changeDm(){
  //called to change the DM name
  var dm_name = document.getElementById('newDmName').value;
  var dm_team = document.querySelector('input[name="dmteam"]:checked').value;
  var token = sessionStorage.getItem('access_token');
  var dmreq = new XMLHttpRequest();
  dmreq.onreadystatechange = function() {
    if (dmreq.readyState == XMLHttpRequest.DONE) {
      if (dmreq.status == 201) {
        refreshDmInfo();
        document.getElementById('newDmPage').style.display = 'none';
      }
    }
  };
  data = '{"name": "'+dm_name+'", "team": "'+dm_team+'"}'
  dmreq.open("POST", "http://localhost:5000/dms/");
  dmreq.setRequestHeader('Content-Type', 'application/json');
  dmreq.setRequestHeader('Authorization', 'JWT '+token);
  dmreq.send(data);
}

function refreshDmInfo(){
  var token = sessionStorage.getItem('access_token');
  var dmreq = new XMLHttpRequest();
  dmreq.onreadystatechange = function() {
    if (dmreq.readyState == XMLHttpRequest.DONE) {
      if (dmreq.status == 200) {
        // parse the response
        r = JSON.parse(dmreq.responseText);
        document.getElementById('dmname').innerHTML = r['name'];
        document.getElementById('dmkills').innerHTML = r['numkills'];
        document.getElementById('dmteam').innerHTML = r['team'];
        
        // write dm info out to files
        fs.writeFileSync(output_dir+'/dmname.txt', r['name']);
        fs.writeFileSync(output_dir+'/dmkills.txt', r['numkills']);
        fs.writeFileSync(output_dir+'/teamname.txt', r['team']);
      }
    }
  }
  dmreq.open("GET", "http://localhost:5000/currentdm/");
  //dmreq.setRequestHeader('Content-Type', 'application/json');
  dmreq.setRequestHeader('Authorization', 'JWT '+token);
  dmreq.send();

}


document.addEventListener("DOMContentLoaded", function(event) {
  setupApiEndpoint();
  setupAdminToken();
  document.getElementById('commentbox').addEventListener('input', updateStatusBar);
  setInterval(refreshPlayerList, 30000);
  refreshPlayingClock();
  setInterval(refreshPlayingClock, 60000);


  // Show the new DM screen
  document.getElementById('changedm').addEventListener('click', function() {
    document.getElementById('newDmPage').style.display = 'block';
  });
  document.getElementById('changedm-close').addEventListener('click', function() {
    document.getElementById('newDmPage').style.display = 'none';
  });
  document.getElementById('changedm-save').addEventListener('click', changeDm);

  // reschar
  document.getElementById('reschar-close').addEventListener('click', function(){
    document.getElementById('resCharPage').style.display = 'none';
  });
  document.getElementById('resCharPaying').addEventListener('change', function(event){
    if(document.getElementById('resCharPaying').checked){
      document.getElementById('resCharPay1').removeAttribute('disabled');
      document.getElementById('resCharPay2').removeAttribute('disabled');
    } else {
      document.getElementById('resCharPay1').setAttribute('disabled', 'disabled');
      document.getElementById('resCharPay2').setAttribute('disabled', 'disabled');
    }
  });
  document.getElementById('reschar-save').addEventListener('click', submitRes);
});

