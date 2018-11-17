const fs = require('fs')
const electron = require('electron');

const output_dir = electron.remote.app.getPath("userData"); 
const commentbox_file = output_dir+'/commentbox.txt';
const gameclock_file = output_dir+'/gameclock.txt';
const dmname_file = output_dir+'/dmname.txt';

const playing_clock_start = new Date('2017-11-10T02:00:00Z'); //When DnDonations is starting

var char_names = {};

var dndapi_endpoint;

var commentbox_write;
var seats_locked = [false, false, false, false, false, false];

function pad(n) {
  return (n < 10) ? ("0" + n) : n;
}

function tailPad(pad, str) {
  return (str + pad).substring(0, pad.length);
}


// Reads the url from the textfile, and stores it
function readconfig(){
  var homedir = electron.remote.app.getPath("home");
  dndapi_config = JSON.parse(fs.readFileSync(homedir+"/.dndesktopconfig.json", "utf-8"));

  // Set the global dndapi_endpoint
  dndapi_endpoint = dndapi_config.dndurl;

  var authreq = new XMLHttpRequest();
  authreq.onreadystatechange = function() {
    if (authreq.readyState == XMLHttpRequest.DONE) {
      if (authreq.status == 200) {
        // Store the token in local storage
        r = JSON.parse(authreq.responseText);
        sessionStorage.setItem('access_token', r['access_token']);
        console.log('New token:', sessionStorage.getItem('access_token'));
        refreshPlayerList();
        refreshDmInfo();
        refreshGraveyard();
      } else {
        console.log(authreq);
      }
    }
  };
  authreq.open("POST", dndapi_endpoint+"/api/auth");
  authreq.setRequestHeader('Content-Type', 'application/json');
  var j = {
    "username": dndapi_config.username,
    "password": dndapi_config.password
  }
  authreq.send(JSON.stringify(j));
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
  //Display are you sure dialog
  confirmation = electron.remote.dialog.showMessageBox({
    type: 'question',
    buttons: ['Yes', 'Cancel'],
    defaultId: 1,
    message: 'Kill character "'+char_names[char_id]+'"?',
    cancelId: 1
  });
  if(confirmation == 0){
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
    killreq.open("POST", dndapi_endpoint+"/api/characters/death/"+char_id);
    killreq.setRequestHeader('Authorization', 'JWT '+token);
    killreq.send();
  }else{
    console.log('character not killed');
  }
}

//use token to update player list (playing)
function refreshPlayerList() {
  var token = sessionStorage.getItem('access_token');
  var plreq = new XMLHttpRequest();
  plreq.onreadystatechange = function() {
    if (plreq.readyState == XMLHttpRequest.DONE) {
      if (plreq.status == 200) {
        // parse the response
        r = JSON.parse(plreq.responseText);
        nowDate = new Date();
        th = '';

        console.log(r);
        
        // update char_names map.
        char_names = {};
        for(i=0; i<r['playing'].length; i++){
          if(r['playing'][i] != null){
            id = r['playing'][i]['id'];
            name = r['playing'][i]['name']
            char_names[id] = name;
          }
        }
        for(i=0; i<r['waiting'].length; i++){
          id = r['waiting'][i]['id'];
          name = r['waiting'][i]['name']
          char_names[id] = name;
        }
        // Render table heading
        th += '<thead><tr><th>Seat</th><th>Name</th><th>Race</th><th>Class</th><th>Resses</th><th>Timer</th><th></th></tr></thead>';
        // Render out the table
        for(i=0; i<6; i++){
          th += '<tr>';
          th += '<td width="6%"><p>P'+(i+1)+'</p></td>';
          
          //if(seats_locked[i]){
          if(r['playing'][i] != null){
            th += '<td width="10%">'+r['playing'][i]['name']+'</td>';
            th += '<td width="15%">'+r['playing'][i]['race']+'</td>';
            th += '<td width="19%">'+r['playing'][i]['class']+'</td>';
            th += '<td width="5%">'+r['playing'][i]['num_resses']+'</td>';
            var startDate = new Date(r['playing'][i]['starttime']);
            var diffMs = nowDate - startDate;
            var diffHrs = Math.floor((diffMs % 86400000) / 3600000); // hours
            var diffMins = Math.floor(((diffMs % 86400000) % 3600000) / 60000); // minutes
            var timer = pad(diffHrs)+':'+pad(diffMins);
            th += '<td width="15">'+timer+'</td>';
            th += '<td width="24">';
            th += '<div class="pure-button-group" role="group">';
            th += '<button class="pure-button" onclick="showResPage('+r['playing'][i]['id']+','+r['playing'][i]['num_resses']+');">res</button>';
            th += '<button class="pure-button" onclick="killCharacter('+r['playing'][i]['id']+');">kill</button></td>';
            th += '</div>';
            var nameoutput = r['playing'][i]['name'];
            var classoutput = r['playing'][i]['class'];
            var timeoutput = timer;
          }else{
            // display add player dropdown
            var nameoutput = '';
            th += '<td width="95%" colspan="6"><form class="pure-form">';
            th += '<fieldset><select style="width: 200px;" id="entry-'+(i+1)+'">';
            for(j=0; j<r['waiting'].length; j++){
              th += '<option value="'+r['waiting'][j]['id']+'">';
              th += (j+1)+") "+r['waiting'][j]['name']+'</option>';
            }
            th += '</select> ';
            th += '<button class="pure-button pure-button-primary" ';
            th += 'id="add-'+(i+1)+'"';
            th += '>Add</button></fieldset></form></td>';
            // if(i==0 || i==1 || i==5){
            //   var box = document.getElementById('lock-'+(i+1));
            //   if(box && box.checked){
            //     nameoutput = 'LOCKED';
            //     th += ' disabled';
            //   }
            // }
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
        // Add event listeners to locked rows
        // document.getElementById("lock-1").addEventListener('change', mkLockSeatListener(1));
        // document.getElementById("lock-2").addEventListener('change', mkLockSeatListener(2));
        // document.getElementById("lock-6").addEventListener('change', mkLockSeatListener(6));
        // Update the perilLevel
        var peril = 0;
        switch(r['waiting'].length){
          case 0:
          case 1:
            peril = 1;
            break;
          case 2:
            peril = 2;
            break;
          case 3:
            peril = 3;
            break;
          case 4:
            peril = 4;
            break;
          default:
            peril = 5;
        }
        document.getElementById('perilLvl').innerHTML = peril.toString();
        fs.writeFileSync(output_dir+'/perillvl.txt', peril);

        // Render out the next donation goal.
        var nextgoal = document.getElementById('nextGoal').value;
        fs.writeFileSync(output_dir+'/nextgoal.txt', nextgoal);
      } else {
        console.log(plreq);
      }
    }
  };

  plreq.open("GET", dndapi_endpoint+"/api/queue/");
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
        var padding = Array(12).join(' ');
        output_txt = ''
        for(i=0; i<r.length; i++) {
          var playercol = r[i]['player']
          if(r[i]['player'].length > 10){
            playercol = r[i]['player'].substring(0,10);
          }
          output_txt += tailPad(padding, playercol);
          output_txt += tailPad(padding, r[i]['name']);
          var hours = Math.floor(r[i]['seconds_alive'] / 3600);
          var mins = Math.floor((r[i]['seconds_alive'] % 3600) / 60);
          output_txt += pad(hours)+':'+pad(mins);
          output_txt += '\n';
        }
        output_txt += Array(15).join('\n');
        fs.writeFileSync(output_dir+'/graveyard.txt', output_txt);
      }
    }
  }
  
  gyreq.open("GET", dndapi_endpoint+"/api/characters/graveyard/");
  gyreq.setRequestHeader('Content-Type', 'application/json');
  gyreq.setRequestHeader('Authorization', 'JWT '+token);
  gyreq.send();
}

function mkLockSeatListener(row){
  return function(e){
    e.preventDefault();
    seats_locked[row-1] = document.getElementById('lock-'+row).checked;
    refreshPlayerList();
  };
}

function mkAddClickListener(row){
  return function(e){
    e.preventDefault();
    
    //console.log('Clicked add-', row);
    var charid = document.getElementById('entry-'+row).value;
    // have the operator confirm addition
    confirmation = electron.remote.dialog.showMessageBox({
      type: 'question',
      buttons: ['Yes', 'Cancel'],
      defaultId: 1,
      message: 'Add character "'+char_names[charid]+'" to seat '+row+'?',
      cancelId: 1
    });
    if(confirmation == 0){
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
      spreq.open("POST", dndapi_endpoint+"/api/characters/startplay/"+charid);
      spreq.setRequestHeader('Content-Type', 'application/json');
      spreq.setRequestHeader('Authorization', 'JWT '+token);
      spreq.send(data);
    }
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
  document.getElementById('resCharCost').innerHTML = 5 * (Math.pow(2,num_resses));
  document.getElementById('resCharPage').style.opacity = '1';
  document.getElementById('resCharPage').style.pointerEvents = 'auto';
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
        document.getElementById('resCharPage').style.pointerEvents = 'none';
        document.getElementById('resCharPage').style.opacity = '0';
        refreshPlayerList();
        refreshDmInfo();
      }
    }
  };

  var amt = document.getElementById('resCharCost').innerHTML;
  var payment = document.getElementById('resPayForm').value;
  var data = '{"donation": null}'
  if(document.getElementById('resCharPaying').checked){
    data = '{"donation": {"amt": '+amt+', "method": "'+payment+'"}}'
  }
  resreq.open("POST", dndapi_endpoint+"/api/characters/res/"+charid);
  resreq.setRequestHeader('Content-Type', 'application/json');
  resreq.setRequestHeader('Authorization', 'JWT '+token);
  resreq.send(data);
}

function changeDm(){
  //called to change the DM name
  var dm_name = document.getElementById('newDmName').value;
  var dm_team = document.getElementById('newDmTeam').value;
  var token = sessionStorage.getItem('access_token');
  var dmreq = new XMLHttpRequest();
  dmreq.onreadystatechange = function() {
    if (dmreq.readyState == XMLHttpRequest.DONE) {
      if (dmreq.status == 201) {
        refreshDmInfo();
        document.getElementById('newDmPage').style.opacity = '0';
        document.getElementById('newDmPage').style.pointerEvents = 'none';
      }
    }
  };
  data = '{"name": "'+dm_name+'", "team": "'+dm_team+'"}'
  dmreq.open("POST", dndapi_endpoint+"/api/dms/");
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
  dmreq.open("GET", dndapi_endpoint+"/api/currentdm/");
  //dmreq.setRequestHeader('Content-Type', 'application/json');
  dmreq.setRequestHeader('Authorization', 'JWT '+token);
  dmreq.send();


  // Also pull the dm team kills
  var teamreq = new XMLHttpRequest();
  teamreq.onreadystatechange = function() {
    if (teamreq.readyState == XMLHttpRequest.DONE) {
      if (teamreq.status == 200) {
        // parse the response
        r = JSON.parse(teamreq.responseText);
        document.getElementById('duskpatrolKills').innerHTML = r['duskpatrol'];
        document.getElementById('moonwatchKills').innerHTML = r['moonwatch'];
        document.getElementById('sunguardKills').innerHTML = r['sunguard'];
        
        // write dm info out to files
        fs.writeFileSync(output_dir+'/killsduskpatrol.txt', r['duskpatrol']);
        fs.writeFileSync(output_dir+'/killsmoonwatch.txt', r['moonwatch']);
        fs.writeFileSync(output_dir+'/killssunguard.txt', r['sunguard']);
        fs.writeFileSync(output_dir+'/killstotal.txt', r['duskpatrol']+r['moonwatch']+r['sunguard']);
      }
    }
  }
  teamreq.open("GET", dndapi_endpoint+"/api/dmteamkills/");
  teamreq.setRequestHeader('Authorization', 'JWT '+token);
  teamreq.send();
}


document.addEventListener("DOMContentLoaded", function(event) {
  readconfig();
  document.getElementById('commentbox').addEventListener('input', updateStatusBar);
  setInterval(refreshPlayerList, 30000);
  refreshPlayingClock();
  setInterval(refreshPlayingClock, 60000);
  // get a new admin token every hour
  setInterval(readconfig, 3600000);

  // Show the new DM screen
  document.getElementById('changedm').addEventListener('click', function() {
    document.getElementById('newDmPage').style.opacity = '1';
    document.getElementById('newDmPage').style.pointerEvents = 'auto';
  });
  document.getElementById('changedm-close').addEventListener('click', function() {
    document.getElementById('newDmPage').style.pointerEvents = 'none';
    document.getElementById('newDmPage').style.opacity = '0';
  });
  document.getElementById('changedm-save').addEventListener('click', changeDm);

  // reschar
  document.getElementById('reschar-close').addEventListener('click', function(){
    document.getElementById('resCharPage').style.pointerEvents = 'none';
    document.getElementById('resCharPage').style.opacity = '0';
  });
  document.getElementById('resCharPaying').addEventListener('change', function(event){
    if(document.getElementById('resCharPaying').checked){
      document.getElementById('resPayForm').removeAttribute('disabled');
    } else {
      document.getElementById('resPayForm').setAttribute('disabled', 'disabled');
    }
  });
  document.getElementById('reschar-save').addEventListener('click', submitRes);
});

