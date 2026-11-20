(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const icon = globalThis.gameIcon;
  const path = [
    [-.02,.512],[.055,.51],[.115,.507],[.152,.515],[.183,.531],[.206,.557],
    [.224,.59],[.241,.634],[.261,.678],[.279,.706],[.306,.728],[.338,.736],
    [.37,.729],[.395,.715],[.422,.68],[.447,.632],[.471,.565],[.49,.5],
    [.512,.416],[.531,.354],[.553,.302],[.581,.275],[.613,.257],[.65,.249],
    [.681,.257],[.711,.28],[.733,.314],[.751,.365],[.765,.416],[.78,.462],
    [.801,.504],[.824,.537],[.845,.58]
  ];
  const pads = [[.285,.566],[.153,.403],[.376,.598],[.55,.655],[.423,.365],[.638,.465],[.749,.225],[.748,.605]];
  const types = {
    flame: {name:"Flammenkerze",role:"Einzelziel",text:"Verschießt goldene Flammenkugeln auf das vorderste Ziel in Reichweite."},
    splash:{name:"Glutkerze",role:"Flächenschaden",text:"Schleudert Glutkugeln, die beim Aufprall auch Gegner in der Umgebung treffen."},
    frost: {name:"Frostkerze",role:"Verlangsamung",text:"Eisflammen verlangsamen getroffene Gegner für 1,9 Sekunden um 48 %."},
    aura:  {name:"Aurakerze",role:"Verstärkung",text:"Erhöht die Feuerrate benachbarter Angriffstürme. Bei überlappenden Auren wirkt die stärkste."}
  };
  const game = new TD.Game(path,pads);
  const painter = new BattlePainter($("battle"),game);
  const sounds = new GameSound();
  const keys = Object.keys(types);
  const dialog = $("dialog");
  const arena = $("arena");
  const detail = $("detail");
  let selected = "flame";
  let inspected = null;
  let hovered = null;
  let paused = false;
  let speed = 1;
  let soundOn = true;
  let noticeTimer = 0;
  let lastUI = "";
  let prevTime = performance.now();
  let visualTime = 0;
  let lastSoundTime = 0;
  let modal = null;
  try { soundOn = localStorage.getItem("dochtwacht-ton") !== "aus"; } catch {}

  const number = n => n.toLocaleString("de-DE");
  const waveNumber = () => game.state === "ready" ? game.wave + 1 : Math.max(1,game.wave);
  const digits = n => String(n).padStart(2,"0");
  const imagePath = key => "assets/tower-" + key + ".png";
  const closeButton = '<button class="close" aria-label="Schließen" title="Schließen">'+icon("close")+'</button>';
  function play(name) { if (soundOn) sounds.play(name); }
  function notice(message) {
    $("notice").textContent = message;
    $("notice").classList.add("show");
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => $("notice").classList.remove("show"),2400);
  }
  document.addEventListener("pointerdown",() => { if (soundOn) sounds.enable(true); },{once:true});
  document.addEventListener("keydown",() => { if (soundOn) sounds.enable(true); },{once:true});

  function updateSound() {
    const button = $("sound");
    button.innerHTML = icon(soundOn ? "sound" : "mute");
    button.title = soundOn ? "Ton ausschalten" : "Ton einschalten";
    button.setAttribute("aria-label",button.title);
    button.setAttribute("aria-pressed",String(soundOn));
  }

  function initCards() {
    for (const [i,key] of keys.entries()) {
      const type = types[key];
      const card = document.createElement("button");
      card.className = "tower-card";
      card.dataset.type = key;
      card.setAttribute("aria-label",type.name + ", " + type.role + ", " + TD.TOWERS[key].cost + " Essenz. Taste " + (i+1));
      card.title = type.text + " · Taste " + (i+1);
      card.innerHTML = '<img class="tower-art" src="'+imagePath(key)+'" alt="" draggable="false"><span class="shortcut">'+(i+1)+'</span><span class="card-role">'+type.role+'</span><span class="card-name">'+type.name+'</span><span class="price">'+icon("crystal")+TD.TOWERS[key].cost+'</span>';
      card.addEventListener("click",() => selectType(key));
      $("cards").append(card);
    }
  }
  function selectType(key) {
    if (game.state === "lost") return;
    closeDetail();
    selected = key;
    play("select");
    updateUI(true);
    if (game.essence < TD.TOWERS[key].cost) notice("Für diese Kerze fehlen "+number(TD.TOWERS[key].cost-game.essence)+" Essenz.");
  }
  function initPads() {
    const container = $("sites");
    container.replaceChildren();
    game.pads.forEach((pad,i) => {
      const button = document.createElement("button");
      button.className = "pad";
      button.style.left = (pad.x*100)+"%";
      button.style.top = (pad.y*100)+"%";
      button.addEventListener("pointerenter",e => { if(e.pointerType !== "touch") { hovered = i; showRange(); } });
      button.addEventListener("pointerleave",() => { if(hovered === i) hovered = null; showRange(); });
      button.addEventListener("focus",() => { hovered = i; showRange(); });
      button.addEventListener("blur",() => { if(hovered === i) hovered = null; showRange(); });
      button.addEventListener("click",() => usePad(i));
      container.append(button);
      renderPad(i);
    });
  }
  function renderPad(i) {
    const button = $("sites").children[i];
    const tower = game.pads[i].tower;
    button.classList.toggle("occupied",!!tower);
    if (tower) {
      button.dataset.type = tower.type;
      button.innerHTML = '<img src="'+imagePath(tower.type)+'" alt="" draggable="false"><span class="pips">'+Array.from({length:4},(_,j) => '<i class="'+(j<tower.level?'lit':'')+'"></i>').join("")+'</span>';
      button.title = types[tower.type].name+" · Stufe "+tower.level+" · Ausbauen";
    } else {
      delete button.dataset.type;
      button.innerHTML = '<img src="assets/foundation.png" alt="" draggable="false"><span class="pad-symbol" aria-hidden="true">+</span>';
      button.title = "Freier Bauplatz "+(i+1);
    }
    button.setAttribute("aria-label",button.title);
  }
  function usePad(i) {
    if (game.state === "lost") return;
    if (game.pads[i].tower) { openDetail(i);return; }
    if (!selected) { notice("Wähle zuerst eine Kerze aus dem Arsenal.");return; }
    closeDetail();
    if (game.build(selected,i)) {
      renderPad(i);
      play("build");
      notice(types[selected].name+" errichtet.");
      showRange();
      updateUI(true);
    } else {
      notice("Zum Bauen fehlen "+number(Math.max(0,TD.TOWERS[selected].cost-game.essence))+" Essenz.");
    }
  }
  function showRange() {
    const i = typeof inspected === "number" ? inspected : hovered;
    const pad = game.pads[i];
    const type = pad?.tower?.type || selected;
    const range = $("range");
    if (!pad || !type || inspected === "shrine" || modal) {range.hidden = true;return;}
    range.hidden = false;
    range.style.left = pad.x*100+"%";
    range.style.top = pad.y*100+"%";
    range.style.width = 200*TD.TOWERS[type].range+"%";
    range.style.height = 200*TD.TOWERS[type].range*1.95+"%";
  }
  function closeDetail() {
    inspected = null;
    detail.hidden = true;
    showRange();
  }
  function openDetail(target) {
    if (game.state === "lost") return;
    if (inspected === target && !detail.hidden) {closeDetail();return;}
    inspected = target;
    play("select");
    detail.hidden = false;
    renderDetail();
    showRange();
  }
  function detailCost() { return inspected === "shrine" ? game.shrineUpgradeCost() : game.towerUpgradeCost(inspected); }
  function positionDetail() {
    if (detail.hidden) return;
    const target = inspected === "shrine" ? $("shrine") : $("sites").children[inspected];
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const map = arena.getBoundingClientRect();
    const w = detail.offsetWidth, h = detail.offsetHeight;
    let x = rect.right - map.left + 14;
    if (x+w+10>map.width) x = rect.left-map.left-w-14;
    detail.style.left = Math.max(8,Math.min(map.width-w-8,x))+"px";
    detail.style.top = Math.max(8,Math.min(map.height-h-8,rect.top-map.top+rect.height/2-h/2))+"px";
  }
  function renderDetail() {
    if (inspected === null || detail.hidden) return;
    const shrine = inspected === "shrine";
    const tower = shrine ? null : game.pads[inspected].tower;
    if (!shrine && !tower) return closeDetail();
    const level = shrine ? game.shrineLevel : tower.level;
    const stats = shrine ? null : game.towerStats(inspected);
    const cost = detailCost();
    const maxed = !Number.isFinite(cost);
    const name = shrine ? "Der Schrein" : types[tower.type].name;
    const desc = shrine ? "Jeder Ausbau erhöht das Lebensmaximum um 25 und heilt bis zu 50 Leben." : types[tower.type].text;
    const factName = shrine ? "Lebenspunkte" : tower.type === "aura" ? "Feuerratenbonus" : "Feuerrate";
    const rateText = rate => rate.toLocaleString("de-DE",{maximumFractionDigits:2});
    const next = shrine || maxed ? null : game.towerStats(inspected,level+1);
    let factValue = game.hp+" / "+game.maxHp;
    if (!shrine && tower.type === "aura") factValue = "+"+Math.round(stats.buff*100)+(next?" → +"+Math.round(next.buff*100):"")+" %";
    else if (!shrine) factValue = rateText(stats.rate)+(next?" → "+rateText(next.rate):"")+" / Sek.";
    const action = maxed ? "Höchste Stufe erreicht" : 'Ausbauen · '+icon("crystal")+number(cost);
    detail.innerHTML = closeButton+'<div class="micro">Stufe '+level+(shrine ? '' : ' / 4')+'</div><h3>'+name+'</h3><p>'+desc+'</p><div class="fact"><span>'+factName+'</span><strong>'+factValue+'</strong></div><button class="gold-btn" '+((maxed || cost>game.essence) ? 'disabled' : '')+'>'+action+'</button>';
    detail.querySelector(".close").onclick = closeDetail;
    detail.querySelector(".gold-btn").onclick = () => {
      if (!(shrine ? game.upgradeShrine() : game.upgradeTower(inspected))) return;
      if (!shrine) renderPad(inspected);
      play("upgrade");
      notice(name+" auf Stufe "+(level+1)+" ausgebaut.");
      updateUI(true);
    };
    positionDetail();
  }
  function updateUI(force=false) {
    const stateString = [game.state,game.wave,game.essence,game.hp,game.maxHp,game.waveDefeated,game.waveEscaped,game.towers.length,selected,paused].join("|");
    if (!force && stateString === lastUI) return;
    lastUI = stateString;
    const active = game.state === "running";
    const lost = game.state === "lost";
    const n = waveNumber();
    $("essence").textContent = number(game.essence);
    $("hp").textContent = number(game.hp);
    $("maxhp").textContent = number(game.maxHp);
    $("wave").textContent = digits(n);
    $("shrine-health").style.width = 100*game.hp/game.maxHp+"%";
    $("phase").className = "phase"+(active ? " running" : "")+(paused ? " paused" : "");
    $("phase").querySelector("span").textContent = lost ? "Schrein gefallen" : paused ? "Pausiert" : active ? "Angriff" : "Bauphase";
    $("pause").disabled = !active;
    $("pause").innerHTML = icon(paused?"play":"pause");
    $("pause").setAttribute("aria-label",paused?"Spiel fortsetzen":"Spiel pausieren");
    $("pause-flag").hidden = !paused || modal !== null;
    $("wave-label").textContent = active || lost ? "Aktuelle Welle" : "Nächste Welle";
    $("wave-no").textContent = "Welle "+digits(n);
    const count = active || lost ? Math.max(0,game.waveTotal-game.waveDefeated-game.waveEscaped) : TD.wavePlan(n).length;
    $("wave-count").innerHTML = icon("skull")+number(count)+" Gegner";
    $("start").firstElementChild.innerHTML = icon(active && !paused ? "pause" : "play");
    $("start-text").textContent = lost ? "Neu beginnen" : (active ? (paused ? "Fortsetzen" : "Pausieren") : "Welle starten");
    const free = pads.length - game.towers.length;
    $("free-pads").textContent = free+" "+(free===1?"freier Bauplatz":"freie Bauplätze");
    for (const card of $("cards").children) {
      const isSelected = card.dataset.type === selected;
      card.classList.toggle("selected",isSelected);
      card.classList.toggle("poor",game.essence<TD.TOWERS[card.dataset.type].cost);
      card.setAttribute("aria-pressed",String(isSelected));
    }
    $("hint").textContent = free ? "Wähle eine Kerze und klicke auf einen freien Bauplatz." : "Klicke auf einen Turm oder den Schrein, um ihn auszubauen.";
    renderDetail();
  }
  function advance() {
    if (modal) return;
    if (game.state === "lost") return gameOver();
    if (game.state === "running") {
      paused = !paused;
      play("select");
    } else if (game.startWave()) {
      closeDetail();
      $("notice").classList.remove("show");
      paused = false;
      play("wave");
    }
    updateUI(true);
  }
  function showDialog(kind,html) {
    closeDetail();
    modal = kind;
    $("dialog-body").innerHTML = html;
    $("dialog-body").querySelector("h2").id = "dialog-title";
    if (!dialog.open) dialog.showModal();
    showRange();
    updateUI(true);
  }
  function help() {
    if (modal || game.state === "lost") return;
    const list = keys.map(key => '<div><img src="'+imagePath(key)+'" alt=""><div><b>'+types[key].name+'</b><span>'+types[key].text+'</span></div></div>').join("");
    showDialog("help",closeButton+'<div class="dialog-intro micro">Spielanleitung</div><h2>Den Schrein verteidigen</h2><p>Wähle eine Kerze und besetze einen freien Steinsockel. Starte die Welle, wenn deine Verteidigung bereit ist. Für jeden besiegten Gegner erhältst du seine maximalen Lebenspunkte als Essenz.</p><div class="help-list">'+list+'</div><p>Ein Klick auf einen Turm öffnet seine drei Aufwertungen. Den Schrein kannst du heilen und ausbauen. Mit jeder Welle wächst der Ansturm. Ab Welle 3 erscheinen Irrgeister, ab Welle 6 gehörnte Kolosse.</p><div class="manual-keys" style="margin-top:18px"><kbd>1–4</kbd> Turmauswahl <kbd>Leertaste</kbd> Start / Pause <kbd>Esc</kbd> Schließen</div>');
    dialog.querySelector(".close").onclick = () => dialog.close();
  }
  function gameOver() {
    paused = false;
    showDialog("lost",'<div class="dialog-intro micro">Der Schrein ist gefallen</div><h2>Das letzte Licht</h2><p>Du hast '+number(game.wave-1)+' Wellen überstanden und '+number(game.kills)+' Gegner besiegt.</p><button class="gold-btn" id="restart">'+icon("play")+'Erneut verteidigen</button>');
    $("restart").onclick = () => {
      dialog.close();modal=null;
      game.reset();
      selected="flame";hovered=null;speed=1;paused=false;
      $("speed").textContent="1×";
      $("notice").classList.remove("show");
      initPads();updateUI(true);play("build");
    };
  }
  $("start").onclick = advance;
  $("pause").onclick = advance;
  $("manual").onclick = help;
  $("shrine").onclick = $("top-shrine").onclick = () => openDetail("shrine");
  $("sound").onclick = () => {
    soundOn = !soundOn;
    sounds.enable(soundOn);
    try { localStorage.setItem("dochtwacht-ton",soundOn?"an":"aus"); } catch {}
    updateSound();play("select");
  };
  $("speed").onclick = () => { speed = speed%3+1; $("speed").textContent=speed+"×";play("select"); };
  $("full").onclick = async () => {
    try {
      if(document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {notice("Vollbild über die F11-Taste aktivieren.");}
  };
  document.addEventListener("fullscreenchange",() => {
    const full = !!document.fullscreenElement;
    $("full").innerHTML = icon(full?"collapse":"expand");
    $("full").title = full?"Vollbild verlassen":"Vollbild";
    $("full").setAttribute("aria-label",$("full").title);
  });
  dialog.addEventListener("cancel",e => { if (modal==="lost") e.preventDefault(); });
  dialog.addEventListener("close",() => { modal=null;updateUI(true);prevTime=performance.now(); });
  dialog.addEventListener("click",e => { if(e.target===dialog && modal==="help") dialog.close(); });
  arena.addEventListener("click",e => { if (!e.target.closest("button,.detail")) closeDetail(); });
  window.addEventListener("resize",positionDetail);
  document.addEventListener("keydown",e => {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || modal) return;
    if (e.key==="Escape") {closeDetail();return;}
    if (e.code==="Space") {e.preventDefault();advance();return;}
    if (["1","2","3","4"].includes(e.key)) {e.preventDefault();selectType(keys[Number(e.key)-1]);}
    if (e.key.toLowerCase()==="h") help();
  });
  document.addEventListener("visibilitychange",() => {
    prevTime = performance.now();
    if (document.hidden && game.state==="running") {paused=true;updateUI(true);}
  });
  function frame(now) {
    const dt = Math.min(.09,Math.max(0,(now-prevTime)/1000));
    prevTime=now;
    if (!paused && !modal && !document.hidden) {
      const oldState=game.state, oldHp=game.hp, oldKills=game.kills;
      game.tick(dt*speed);
      visualTime+=dt*speed;
      if (oldHp>game.hp) play("leak");
      else if (oldKills<game.kills && now-lastSoundTime>210) {play("hit");lastSoundTime=now;}
      if (oldState==="running" && game.state==="ready") {
        notice("Welle "+digits(game.wave)+" überstanden.");play("end");
      } else if (game.state==="lost" && oldState!=="lost") {play("leak");gameOver();}
      updateUI();
    }
    painter.draw(visualTime);
    requestAnimationFrame(frame);
  }
  initCards();initPads();updateUI(true);updateSound();
  requestAnimationFrame(frame);
})();
