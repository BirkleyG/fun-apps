import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as d3 from "d3";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, provider } from "./firebase";

/* ===================== DATA ===================== */

const CD = {
  4:{n:"Afghanistan",c:"AS"},8:{n:"Albania",c:"EU"},12:{n:"Algeria",c:"AF"},
  20:{n:"Andorra",c:"EU"},24:{n:"Angola",c:"AF"},51:{n:"Armenia",c:"AS"},
  32:{n:"Argentina",c:"SA"},36:{n:"Australia",c:"OC"},40:{n:"Austria",c:"EU"},
  31:{n:"Azerbaijan",c:"AS"},44:{n:"Bahamas",c:"NA"},48:{n:"Bahrain",c:"AS"},
  50:{n:"Bangladesh",c:"AS"},52:{n:"Barbados",c:"NA"},112:{n:"Belarus",c:"EU"},
  56:{n:"Belgium",c:"EU"},84:{n:"Belize",c:"NA"},204:{n:"Benin",c:"AF"},
  64:{n:"Bhutan",c:"AS"},68:{n:"Bolivia",c:"SA"},70:{n:"Bosnia & Herz.",c:"EU"},
  72:{n:"Botswana",c:"AF"},76:{n:"Brazil",c:"SA"},96:{n:"Brunei",c:"AS"},
  100:{n:"Bulgaria",c:"EU"},854:{n:"Burkina Faso",c:"AF"},108:{n:"Burundi",c:"AF"},
  132:{n:"Cabo Verde",c:"AF"},116:{n:"Cambodia",c:"AS"},120:{n:"Cameroon",c:"AF"},
  124:{n:"Canada",c:"NA"},140:{n:"C. African Rep.",c:"AF"},148:{n:"Chad",c:"AF"},
  152:{n:"Chile",c:"SA"},156:{n:"China",c:"AS"},170:{n:"Colombia",c:"SA"},
  174:{n:"Comoros",c:"AF"},178:{n:"Rep. of Congo",c:"AF"},180:{n:"DR Congo",c:"AF"},
  188:{n:"Costa Rica",c:"NA"},191:{n:"Croatia",c:"EU"},192:{n:"Cuba",c:"NA"},
  196:{n:"Cyprus",c:"EU"},203:{n:"Czech Republic",c:"EU"},208:{n:"Denmark",c:"EU"},
  262:{n:"Djibouti",c:"AF"},214:{n:"Dominican Rep.",c:"NA"},218:{n:"Ecuador",c:"SA"},
  818:{n:"Egypt",c:"AF"},222:{n:"El Salvador",c:"NA"},226:{n:"Equatorial Guinea",c:"AF"},
  232:{n:"Eritrea",c:"AF"},233:{n:"Estonia",c:"EU"},748:{n:"Eswatini",c:"AF"},
  231:{n:"Ethiopia",c:"AF"},242:{n:"Fiji",c:"OC"},246:{n:"Finland",c:"EU"},
  250:{n:"France",c:"EU"},266:{n:"Gabon",c:"AF"},270:{n:"Gambia",c:"AF"},
  268:{n:"Georgia",c:"AS"},276:{n:"Germany",c:"EU"},288:{n:"Ghana",c:"AF"},
  300:{n:"Greece",c:"EU"},320:{n:"Guatemala",c:"NA"},324:{n:"Guinea",c:"AF"},
  624:{n:"Guinea-Bissau",c:"AF"},328:{n:"Guyana",c:"SA"},332:{n:"Haiti",c:"NA"},
  340:{n:"Honduras",c:"NA"},348:{n:"Hungary",c:"EU"},352:{n:"Iceland",c:"EU"},
  356:{n:"India",c:"AS"},360:{n:"Indonesia",c:"AS"},364:{n:"Iran",c:"AS"},
  368:{n:"Iraq",c:"AS"},372:{n:"Ireland",c:"EU"},376:{n:"Israel",c:"AS"},
  380:{n:"Italy",c:"EU"},384:{n:"Ivory Coast",c:"AF"},388:{n:"Jamaica",c:"NA"},
  392:{n:"Japan",c:"AS"},400:{n:"Jordan",c:"AS"},398:{n:"Kazakhstan",c:"AS"},
  404:{n:"Kenya",c:"AF"},296:{n:"Kiribati",c:"OC"},414:{n:"Kuwait",c:"AS"},
  417:{n:"Kyrgyzstan",c:"AS"},418:{n:"Laos",c:"AS"},428:{n:"Latvia",c:"EU"},
  422:{n:"Lebanon",c:"AS"},426:{n:"Lesotho",c:"AF"},430:{n:"Liberia",c:"AF"},
  434:{n:"Libya",c:"AF"},438:{n:"Liechtenstein",c:"EU"},440:{n:"Lithuania",c:"EU"},
  442:{n:"Luxembourg",c:"EU"},450:{n:"Madagascar",c:"AF"},454:{n:"Malawi",c:"AF"},
  458:{n:"Malaysia",c:"AS"},462:{n:"Maldives",c:"AS"},466:{n:"Mali",c:"AF"},
  470:{n:"Malta",c:"EU"},478:{n:"Mauritania",c:"AF"},480:{n:"Mauritius",c:"AF"},
  484:{n:"Mexico",c:"NA"},583:{n:"Micronesia",c:"OC"},498:{n:"Moldova",c:"EU"},
  492:{n:"Monaco",c:"EU"},496:{n:"Mongolia",c:"AS"},499:{n:"Montenegro",c:"EU"},
  504:{n:"Morocco",c:"AF"},508:{n:"Mozambique",c:"AF"},104:{n:"Myanmar",c:"AS"},
  516:{n:"Namibia",c:"AF"},520:{n:"Nauru",c:"OC"},524:{n:"Nepal",c:"AS"},
  528:{n:"Netherlands",c:"EU"},554:{n:"New Zealand",c:"OC"},558:{n:"Nicaragua",c:"NA"},
  562:{n:"Niger",c:"AF"},566:{n:"Nigeria",c:"AF"},408:{n:"North Korea",c:"AS"},
  807:{n:"North Macedonia",c:"EU"},578:{n:"Norway",c:"EU"},512:{n:"Oman",c:"AS"},
  586:{n:"Pakistan",c:"AS"},585:{n:"Palau",c:"OC"},591:{n:"Panama",c:"NA"},
  598:{n:"Papua New Guinea",c:"OC"},600:{n:"Paraguay",c:"SA"},604:{n:"Peru",c:"SA"},
  608:{n:"Philippines",c:"AS"},616:{n:"Poland",c:"EU"},620:{n:"Portugal",c:"EU"},
  634:{n:"Qatar",c:"AS"},642:{n:"Romania",c:"EU"},643:{n:"Russia",c:"EU"},
  646:{n:"Rwanda",c:"AF"},882:{n:"Samoa",c:"OC"},674:{n:"San Marino",c:"EU"},
  682:{n:"Saudi Arabia",c:"AS"},686:{n:"Senegal",c:"AF"},688:{n:"Serbia",c:"EU"},
  690:{n:"Seychelles",c:"AF"},694:{n:"Sierra Leone",c:"AF"},702:{n:"Singapore",c:"AS"},
  703:{n:"Slovakia",c:"EU"},705:{n:"Slovenia",c:"EU"},90:{n:"Solomon Islands",c:"OC"},
  706:{n:"Somalia",c:"AF"},710:{n:"South Africa",c:"AF"},410:{n:"South Korea",c:"AS"},
  728:{n:"South Sudan",c:"AF"},724:{n:"Spain",c:"EU"},144:{n:"Sri Lanka",c:"AS"},
  729:{n:"Sudan",c:"AF"},740:{n:"Suriname",c:"SA"},752:{n:"Sweden",c:"EU"},
  756:{n:"Switzerland",c:"EU"},760:{n:"Syria",c:"AS"},762:{n:"Tajikistan",c:"AS"},
  834:{n:"Tanzania",c:"AF"},764:{n:"Thailand",c:"AS"},626:{n:"Timor-Leste",c:"AS"},
  768:{n:"Togo",c:"AF"},776:{n:"Tonga",c:"OC"},780:{n:"Trinidad & Tobago",c:"NA"},
  788:{n:"Tunisia",c:"AF"},792:{n:"Turkey",c:"AS"},795:{n:"Turkmenistan",c:"AS"},
  800:{n:"Uganda",c:"AF"},804:{n:"Ukraine",c:"EU"},784:{n:"UAE",c:"AS"},
  826:{n:"United Kingdom",c:"EU"},840:{n:"United States",c:"NA"},858:{n:"Uruguay",c:"SA"},
  860:{n:"Uzbekistan",c:"AS"},548:{n:"Vanuatu",c:"OC"},336:{n:"Vatican City",c:"EU"},
  862:{n:"Venezuela",c:"SA"},704:{n:"Vietnam",c:"AS"},887:{n:"Yemen",c:"AS"},
  894:{n:"Zambia",c:"AF"},716:{n:"Zimbabwe",c:"AF"},275:{n:"Palestine",c:"AS"},
  158:{n:"Taiwan",c:"AS"},384:{n:"Ivory Coast",c:"AF"},533:{n:"Aruba",c:"NA"},
  332:{n:"Haiti",c:"NA"},384:{n:"Ivory Coast",c:"AF"},558:{n:"Nicaragua",c:"NA"},
};

const HIST = [
  {id:"soviet-union",name:"Soviet Union",applies:[643,804,398,860,31,268,440,428,233,112,51,762,417]},
  {id:"yugoslavia",name:"Yugoslavia",applies:[191,705,688,70,807]},
  {id:"czechoslovakia",name:"Czechoslovakia",applies:[203,703]},
  {id:"east-germany",name:"East Germany (DDR)",applies:[276]},
  {id:"west-germany",name:"West Germany (BRD)",applies:[276]},
  {id:"ottoman-empire",name:"Ottoman Empire",applies:[792,300,368,400,760,887,376,818]},
  {id:"austro-hungarian",name:"Austro-Hungarian Empire",applies:[40,348,203,703,705,191,70,642]},
  {id:"prussia",name:"Kingdom of Prussia",applies:[276]},
  {id:"british-india",name:"British India",applies:[356,586,50,144]},
  {id:"french-indochina",name:"French Indochina",applies:[704,418,116]},
  {id:"roman-empire",name:"Roman Empire",applies:[380,300,724,250]},
  {id:"weimar",name:"Weimar Republic",applies:[276]},
  {id:"ussr-coins",name:"USSR",applies:[643]},
];

const CONTINENTS = {AS:"Asia",EU:"Europe",AF:"Africa",NA:"North America",SA:"South America",OC:"Oceania"};
const CONTRIBUTORS = ["Birkley","Justin"];

/* ===================== STYLES ===================== */

const INJECT_STYLES = () => {
  if (document.getElementById("ca-styles")) return;
  const el = document.createElement("style");
  el.id = "ca-styles";
  el.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Crimson+Pro:wght@300;400;500&display=swap');
    .ca{--bg:#08121c;--sur:#0f1e2c;--sur2:#162637;--sur3:#1d3045;--gold:#c9a84c;--goldl:#e8d5a3;--goldd:rgba(201,168,76,.13);--goldb:rgba(201,168,76,.22);--txt:#f0ead6;--muted:#7a8fa0;--dim:#3a5060;--red:#d9534f;--grn:#5ab090;--r:12px;--fd:'Playfair Display',Georgia,serif;--fb:'Crimson Pro',Georgia,serif}
    .ca,*{box-sizing:border-box}
    .ca{background:var(--bg);color:var(--txt);font-family:var(--fb);font-size:16px;height:100dvh;min-height:100dvh;display:flex;flex-direction:column;overflow:hidden;user-select:none}
    .ca-hdr{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;background:linear-gradient(180deg,rgba(8,18,28,.96) 0%,rgba(8,18,28,0) 100%);z-index:10;pointer-events:none}
    .ca-ttl{font-family:var(--fd);font-size:21px;font-weight:700;color:var(--gold);letter-spacing:.3px}
    .ca-sub{font-size:12px;color:var(--muted);margin-top:1px}
    .ca-pbadge{background:var(--goldd);border:1px solid var(--goldb);border-radius:20px;padding:5px 13px;font-family:var(--fd);font-size:13px;color:var(--goldl);pointer-events:all;cursor:pointer}
    .ca-map{flex:1;overflow:hidden;background:#05101a;position:relative}
    .ca-map svg{width:100%;height:100%}
    .ca-map path{cursor:pointer;transition:opacity .12s}
    .ca-map path:hover{opacity:.8}
    .ca-filters{display:flex;gap:7px;padding:8px 12px;overflow-x:auto;background:var(--sur);border-top:1px solid var(--sur3);scrollbar-width:none}
    .ca-filters::-webkit-scrollbar{display:none}
    .ca-chip{padding:5px 12px;border-radius:20px;border:1px solid var(--sur3);background:transparent;color:var(--muted);font-family:var(--fb);font-size:13px;cursor:pointer;white-space:nowrap;transition:all .13s}
    .ca-chip.on{border-color:var(--goldb);background:var(--goldd);color:var(--goldl)}
    .ca-bnav{display:flex;background:var(--sur);border-top:1px solid var(--goldb)}
    .ca-nbtn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 0;background:none;border:none;color:var(--muted);font-family:var(--fb);font-size:11px;cursor:pointer;transition:color .13s}
    .ca-nbtn.on{color:var(--gold)}
    .ca-nicon{font-size:19px;line-height:1}
    .ca-fab{position:absolute;bottom:68px;right:18px;width:52px;height:52px;border-radius:50%;background:var(--gold);border:none;color:var(--bg);font-size:26px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px rgba(201,168,76,.4);transition:transform .13s,box-shadow .13s;z-index:20;font-weight:300;line-height:1}
    .ca-fab:hover{transform:scale(1.07);box-shadow:0 6px 24px rgba(201,168,76,.55)}
    .ca-fab:active{transform:scale(.94)}
    .ca-tip{position:fixed;background:var(--sur);border:1px solid var(--goldb);border-radius:8px;padding:6px 11px;font-size:13px;color:var(--txt);pointer-events:none;z-index:30;white-space:nowrap;font-family:var(--fd)}
    .ca-modal{position:absolute;inset:0;background:rgba(5,14,22,.8);backdrop-filter:blur(5px);z-index:50;display:flex;flex-direction:column;justify-content:flex-end}
    .ca-sheet{background:var(--sur);border-radius:20px 20px 0 0;border-top:1px solid var(--goldb);max-height:93vh;overflow-y:auto}
    .ca-handle{width:38px;height:4px;background:var(--sur3);border-radius:2px;margin:12px auto 6px}
    .ca-mhdr{display:flex;align-items:center;justify-content:space-between;padding:6px 20px 14px;border-bottom:1px solid var(--goldb)}
    .ca-mttl{font-family:var(--fd);font-size:20px;font-weight:700;color:var(--gold)}
    .ca-xbtn{width:30px;height:30px;border-radius:50%;background:var(--sur2);border:none;color:var(--muted);font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center}
    .ca-sec{padding:14px 20px}
    .ca-lbl{font-size:11px;text-transform:uppercase;letter-spacing:1.1px;color:var(--muted);margin-bottom:7px}
    .ca-inp{width:100%;background:var(--sur2);border:1px solid var(--sur3);border-radius:var(--r);color:var(--txt);font-family:var(--fb);font-size:15px;padding:10px 14px;outline:none;transition:border-color .13s}
    .ca-inp:focus{border-color:var(--goldb)}
    .ca-inp::placeholder{color:var(--dim)}
    .ca-sel{width:100%;background:var(--sur2);border:1px solid var(--sur3);border-radius:var(--r);color:var(--txt);font-family:var(--fb);font-size:15px;padding:10px 14px;outline:none;appearance:none;cursor:pointer}
    .ca-tgl{flex:1;padding:9px 6px;border-radius:var(--r);background:var(--sur2);border:1px solid var(--sur3);color:var(--muted);font-family:var(--fb);font-size:14px;cursor:pointer;text-align:center;transition:all .13s}
    .ca-tgl.on{background:var(--goldd);border-color:var(--goldb);color:var(--goldl)}
    .ca-irow{background:var(--sur2);border-radius:var(--r);padding:10px 12px;margin-bottom:8px;border:1px solid var(--sur3)}
    .ca-addbtn{width:100%;padding:10px;border-radius:var(--r);background:none;border:1px dashed var(--goldb);color:var(--gold);font-family:var(--fb);font-size:15px;cursor:pointer;transition:background .13s}
    .ca-addbtn:hover{background:var(--goldd)}
    .ca-btn{width:100%;padding:12px;border-radius:var(--r);background:var(--gold);border:none;color:var(--bg);font-family:var(--fd);font-size:16px;font-weight:600;cursor:pointer;transition:opacity .13s;letter-spacing:.2px}
    .ca-btn:hover{opacity:.9}
    .ca-btn:disabled{opacity:.35;cursor:not-allowed}
    .ca-btn2{background:none;border:1px solid var(--goldb);color:var(--gold)}
    .ca-dbtn{background:none;border:none;color:var(--dim);cursor:pointer;padding:3px 5px;font-size:14px;transition:color .13s;flex-shrink:0}
    .ca-dbtn:hover{color:var(--red)}
    .ca-dots{display:flex;align-items:center;justify-content:center;gap:6px;padding:6px 0}
    .ca-dot{width:7px;height:7px;border-radius:50%;background:var(--sur3);transition:background .2s}
    .ca-dot.on{background:var(--gold)}
    .ca-clist{max-height:200px;overflow-y:auto;border-radius:var(--r);border:1px solid var(--sur3)}
    .ca-citem{padding:9px 14px;cursor:pointer;border-bottom:1px solid var(--sur2);display:flex;justify-content:space-between;align-items:center;font-size:15px;transition:background .1s}
    .ca-citem:hover{background:var(--sur2)}
    .ca-citem.on{background:var(--goldd);color:var(--goldl)}
    .ca-citem:last-child{border-bottom:none}
    .ca-page{flex:1;overflow-y:auto;padding:16px}
    .ca-chdr{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--goldb)}
    .ca-cname{font-family:var(--fd);font-size:23px;font-weight:700}
    .ca-badge{display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:20px;font-size:12px;font-weight:500}
    .ca-bg{background:var(--goldd);border:1px solid var(--goldb);color:var(--goldl)}
    .ca-bgray{background:var(--sur2);color:var(--muted);border:1px solid var(--sur3)}
    .ca-bcoin{background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);color:#c9a84c;font-size:11px}
    .ca-bbill{background:rgba(90,176,144,.1);border:1px solid rgba(90,176,144,.2);color:#5ab090;font-size:11px}
    .ca-sgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
    .ca-scard{background:var(--sur);border:1px solid var(--goldb);border-radius:var(--r);padding:14px;text-align:center}
    .ca-snum{font-family:var(--fd);font-size:28px;font-weight:700;color:var(--gold);line-height:1}
    .ca-slbl{font-size:12px;color:var(--muted);margin-top:3px}
    .ca-cbar{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--sur2)}
    .ca-cbar:last-child{border-bottom:none}
    .ca-cbname{flex:1;font-size:14px}
    .ca-cbct{font-family:var(--fd);font-size:14px;color:var(--gold);min-width:38px;text-align:right}
    .ca-cbg{flex:2;height:6px;background:var(--sur2);border-radius:3px;overflow:hidden}
    .ca-cbf{height:100%;background:var(--gold);border-radius:3px;transition:width .5s}
    .ca-ient{background:var(--sur);border:1px solid var(--sur2);border-radius:var(--r);padding:12px 14px;margin-bottom:8px}
    .ca-idn{font-family:var(--fd);font-size:16px;font-weight:500}
    .ca-imt{font-size:12px;color:var(--muted);margin-top:3px}
    .ca-empty{text-align:center;color:var(--dim);padding:32px 16px;font-style:italic;font-size:15px}
    .ca-chk{width:18px;height:18px;border-radius:4px;border:2px solid var(--sur3);background:var(--sur2);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;transition:all .13s}
    .ca-chk.on{border-color:var(--gold);background:var(--goldd);color:var(--gold)}
    .ca-msi{display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer;font-size:15px}
    .ca-sel-pill{margin-top:9px;padding:8px 12px;background:var(--goldd);border:1px solid var(--goldb);border-radius:8px;font-size:14px;color:var(--goldl)}
    .ca-bkbtn{display:flex;align-items:center;gap:5px;background:none;border:none;color:var(--gold);font-family:var(--fb);font-size:15px;cursor:pointer;padding:0;flex-shrink:0}
  `;
  document.head.appendChild(el);
};

/* ===================== STORAGE ===================== */
const APP_DOC_ID = "coin-atlas";
const getAppDocRef = (uid) => doc(db, "users", uid, "apps", APP_DOC_ID);

async function loadData(uid) {
  try {
    const snapshot = await getDoc(getAppDocRef(uid));
    const data = snapshot.data();
    return Array.isArray(data?.entries) ? data.entries : [];
  } catch {
    return [];
  }
}
async function saveData(uid, entries) {
  await setDoc(
    getAppDocRef(uid),
    {
      entries,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

/* ===================== UTILS ===================== */
function uid() { return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
function getCountries(entry) {
  if (entry.isHistorical) return entry.appliesTo || [];
  return entry.countryId ? [entry.countryId] : [];
}

/* ===================== WORLD MAP ===================== */
function WorldMap({ entries, onCountryClick, filterType, filterContributor }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [geoData, setGeoData] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [ready, setReady] = useState(false);

  const collectedSet = useMemo(() => {
    const s = new Map();
    entries.forEach(e => {
      if (filterContributor !== "all" && e.contributor !== filterContributor) return;
      getCountries(e).forEach(cid => {
        if (!s.has(cid)) s.set(cid, { coins: 0, bills: 0 });
        const inf = s.get(cid);
        e.items.forEach(it => {
          if (filterType === "all" || filterType === it.type) {
            if (it.type === "coin") inf.coins++;
            else inf.bills++;
          }
        });
      });
    });
    const r = new Set();
    s.forEach((inf, cid) => { if (inf.coins + inf.bills > 0) r.add(cid); });
    return r;
  }, [entries, filterType, filterContributor]);

  useEffect(() => {
    if (window.topojson) { setReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js";
    s.onload = () => setReady(true);
    s.onerror = () => console.error("topojson failed");
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!ready || geoData) return;
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(r => r.json())
      .then(w => setGeoData(window.topojson.feature(w, w.objects.countries)))
      .catch(e => console.error("world-atlas failed", e));
  }, [ready]);

  useEffect(() => {
    if (!geoData || !svgRef.current || !containerRef.current) return;
    const W = containerRef.current.clientWidth;
    const H = containerRef.current.clientHeight;
    const svg = d3.select(svgRef.current);
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    const proj = d3.geoNaturalEarth1().fitSize([W, H], geoData).translate([W/2, H/2]);
    const path = d3.geoPath().projection(proj);

    svg.selectAll("rect.ocean").data([1]).join("rect")
      .attr("class","ocean").attr("width",W).attr("height",H).attr("fill","#040d15");

    svg.selectAll("path.cty")
      .data(geoData.features)
      .join("path")
      .attr("class","cty")
      .attr("d", path)
      .attr("fill", d => {
        const id = +d.id;
        if (collectedSet.has(id)) return "#c9a84c";
        return CD[id] ? "#192d42" : "#111f2d";
      })
      .attr("stroke","#040d15")
      .attr("stroke-width", 0.4)
      .style("cursor", d => CD[+d.id] ? "pointer" : "default")
      .on("mouseenter", (ev, d) => {
        const n = CD[+d.id]?.n;
        if (n) setTooltip({ x: ev.clientX, y: ev.clientY, n, col: collectedSet.has(+d.id) });
      })
      .on("mousemove", (ev) => {
        setTooltip(t => t ? {...t, x: ev.clientX, y: ev.clientY} : null);
      })
      .on("mouseleave", () => setTooltip(null))
      .on("click", (ev, d) => {
        ev.stopPropagation();
        if (CD[+d.id]) onCountryClick(+d.id);
      });

    svg.selectAll("path.border").data([{type:"Sphere"}]).join("path")
      .attr("class","border").attr("d", path).attr("fill","none")
      .attr("stroke","rgba(201,168,76,0.12)").attr("stroke-width",0.8);
  }, [geoData, collectedSet, onCountryClick]);

  return (
    <div ref={containerRef} className="ca-map">
      <svg ref={svgRef} />
      {!geoData && (
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10,color:"var(--muted)"}}>
          <div style={{fontSize:32,animation:"spin 2s linear infinite"}}>🌍</div>
          <div style={{fontFamily:"var(--fd)",fontSize:13}}>Loading map…</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
      {tooltip && (
        <div className="ca-tip" style={{
          left: Math.min(tooltip.x+10, (window.innerWidth||400)-150),
          top: tooltip.y - 38
        }}>
          {tooltip.col ? "🟡 " : ""}{tooltip.n}
        </div>
      )}
    </div>
  );
}

/* ===================== ADD MODAL ===================== */
function AddModal({ onClose, onSave, preCountryId }) {
  const [step, setStep] = useState(preCountryId ? 1 : 0);
  const [etype, setEtype] = useState("modern");
  const [countryId, setCountryId] = useState(preCountryId ? String(preCountryId) : "");
  const [histId, setHistId] = useState("");
  const [contributor, setContributor] = useState(CONTRIBUTORS[0]);
  const [items, setItems] = useState([{id:uid(),type:"coin",denomination:"",year:"",notes:""}]);
  const [appliesTo, setAppliesTo] = useState([]);
  const [search, setSearch] = useState("");

  const selHist = HIST.find(h => h.id === histId);

  const sortedC = useMemo(() => {
    const q = search.toLowerCase();
    return Object.entries(CD)
      .map(([id, info]) => ({id:+id,...info}))
      .sort((a,b) => a.n.localeCompare(b.n))
      .filter(c => !q || c.n.toLowerCase().includes(q));
  }, [search]);

  const filteredH = useMemo(() => {
    const q = search.toLowerCase();
    return HIST.filter(h => !q || h.name.toLowerCase().includes(q));
  }, [search]);

  const steps = etype === "historical" && step >= 2
    ? ["Entity","Who","Items","Maps To"]
    : ["Entity","Who","Items"];

  const canNext = () => {
    if (step === 0) return etype === "modern" ? !!countryId : !!histId;
    if (step === 1) return true;
    if (step === 2) return items.some(i => i.denomination.trim());
    return true;
  };

  const next = () => {
    if (step === 2) {
      if (etype === "historical" && selHist?.applies.length > 0) {
        setAppliesTo(selHist.applies);
        setStep(3);
      } else { doSave(); }
    } else { setStep(s => s+1); }
  };

  const doSave = () => {
    onSave({
      id: uid(),
      date: new Date().toISOString(),
      contributor,
      isHistorical: etype === "historical",
      countryId: etype === "modern" ? +countryId : null,
      entityId: etype === "historical" ? histId : null,
      entityName: etype === "modern" ? CD[+countryId]?.n : selHist?.name,
      appliesTo: etype === "historical" ? appliesTo : [],
      items: items.filter(i => i.denomination.trim()).map(i => ({...i, id:uid()}))
    });
    onClose();
  };

  const addItem = () => setItems(p => [...p, {id:uid(),type:"coin",denomination:"",year:"",notes:""}]);
  const rmItem = id => setItems(p => p.filter(i => i.id !== id));
  const upItem = (id, f, v) => setItems(p => p.map(i => i.id===id ? {...i,[f]:v} : i));
  const toggleAT = id => setAppliesTo(p => p.includes(id) ? p.filter(x => x!==id) : [...p,id]);

  const displayName = etype === "modern" ? CD[+countryId]?.n : selHist?.name;

  return (
    <div className="ca-modal" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="ca-sheet">
        <div className="ca-handle"/>
        <div className="ca-mhdr">
          <div>
            <div className="ca-mttl">Add to Collection</div>
            <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>
              {steps[step]} — Step {step+1} of {steps.length}
            </div>
          </div>
          <button className="ca-xbtn" onClick={onClose}>✕</button>
        </div>

        <div className="ca-dots">
          {steps.map((_,i)=><div key={i} className={`ca-dot ${i<=step?"on":""}`}/>)}
        </div>

        {/* STEP 0 */}
        {step===0 && (
          <div className="ca-sec">
            <div className="ca-lbl">Type</div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <button className={`ca-tgl ${etype==="modern"?"on":""}`} onClick={()=>setEtype("modern")}>🌍 Modern</button>
              <button className={`ca-tgl ${etype==="historical"?"on":""}`} onClick={()=>setEtype("historical")}>📜 Historical</button>
            </div>
            <div className="ca-lbl">{etype==="modern"?"Country":"Historical Entity"}</div>
            <input className="ca-inp" placeholder="Search…" value={search}
              onChange={e=>setSearch(e.target.value)} style={{marginBottom:8}}/>
            <div className="ca-clist">
              {etype==="modern" ? (
                sortedC.length===0
                  ? <div className="ca-empty" style={{padding:16}}>No results</div>
                  : sortedC.map(c=>(
                    <div key={c.id} className={`ca-citem ${countryId==c.id?"on":""}`}
                      onClick={()=>{setCountryId(String(c.id));setSearch("");}}>
                      <span>{c.n}</span>
                      <span style={{fontSize:12,color:"var(--muted)"}}>{CONTINENTS[c.c]}</span>
                    </div>
                  ))
              ) : (
                filteredH.length===0
                  ? <div className="ca-empty" style={{padding:16}}>No results</div>
                  : filteredH.map(h=>(
                    <div key={h.id} className={`ca-citem ${histId===h.id?"on":""}`}
                      onClick={()=>{setHistId(h.id);setSearch("");}}>
                      <span>{h.name}</span>
                      <span style={{fontSize:11,color:"var(--muted)"}}>→ {h.applies.length} countries</span>
                    </div>
                  ))
              )}
            </div>
            {displayName && (
              <div className="ca-sel-pill">✓ {displayName}</div>
            )}
          </div>
        )}

        {/* STEP 1 */}
        {step===1 && (
          <div className="ca-sec">
            <div className="ca-lbl">Who added this?</div>
            <div style={{display:"flex",gap:8}}>
              {CONTRIBUTORS.map(c=>(
                <button key={c} className={`ca-tgl ${contributor===c?"on":""}`}
                  onClick={()=>setContributor(c)}>{c}</button>
              ))}
            </div>
            {displayName && (
              <div style={{marginTop:14,padding:"10px 14px",background:"var(--sur2)",borderRadius:"var(--r)",fontSize:14,color:"var(--muted)"}}>
                Adding items for <span style={{color:"var(--goldl)",fontFamily:"var(--fd)"}}>{displayName}</span>
              </div>
            )}
          </div>
        )}

        {/* STEP 2 */}
        {step===2 && (
          <div className="ca-sec">
            <div className="ca-lbl">Items for {displayName}</div>
            {items.map((item,idx)=>(
              <div key={item.id} className="ca-irow">
                <div style={{display:"flex",gap:7,marginBottom:7}}>
                  <button className={`ca-tgl ${item.type==="coin"?"on":""}`}
                    style={{fontSize:13,padding:"6px"}} onClick={()=>upItem(item.id,"type","coin")}>🪙 Coin</button>
                  <button className={`ca-tgl ${item.type==="bill"?"on":""}`}
                    style={{fontSize:13,padding:"6px"}} onClick={()=>upItem(item.id,"type","bill")}>💵 Bill</button>
                </div>
                <div style={{display:"flex",gap:7,alignItems:"center"}}>
                  <input className="ca-inp" placeholder="Denomination (e.g. 2 Euro, 50 Pfennig)"
                    value={item.denomination} onChange={e=>upItem(item.id,"denomination",e.target.value)}
                    style={{flex:1,minWidth:0}}/>
                  <input className="ca-inp" placeholder="Year" value={item.year}
                    onChange={e=>upItem(item.id,"year",e.target.value)}
                    style={{width:82,flexShrink:0}} type="number" min="1" max="2099"/>
                  {items.length>1 && (
                    <button className="ca-dbtn" onClick={()=>rmItem(item.id)}>🗑</button>
                  )}
                </div>
              </div>
            ))}
            <button className="ca-addbtn" onClick={addItem}>+ Add another item</button>
          </div>
        )}

        {/* STEP 3 */}
        {step===3 && (
          <div className="ca-sec">
            <div className="ca-lbl">This item applies to (select countries)</div>
            <div style={{maxHeight:240,overflowY:"auto"}}>
              {(selHist?.applies||[]).map(cid=>(
                <div key={cid} className="ca-msi" onClick={()=>toggleAT(cid)}>
                  <div className={`ca-chk ${appliesTo.includes(cid)?"on":""}`}>
                    {appliesTo.includes(cid)?"✓":""}
                  </div>
                  <span>{CD[cid]?.n || `Country ${cid}`}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ca-sec" style={{paddingTop:8}}>
          <div style={{display:"flex",gap:8}}>
            {step>0 && (
              <button className="ca-btn ca-btn2" style={{flex:1}} onClick={()=>setStep(s=>s-1)}>← Back</button>
            )}
            <button className="ca-btn" style={{flex:2}} disabled={!canNext()}
              onClick={step===steps.length-1 ? doSave : next}>
              {step===steps.length-1 ? "✓ Save" : "Continue →"}
            </button>
          </div>
        </div>
        <div style={{height:10}}/>
      </div>
    </div>
  );
}

/* ===================== COUNTRY DETAIL ===================== */
function CountryDetail({ countryId, entries, onClose, onAdd }) {
  const [ft, setFt] = useState("all");
  const [fc, setFc] = useState("all");
  const cinfo = CD[countryId];
  if (!cinfo) return null;

  const relevant = useMemo(() => entries.filter(e => {
    if (!getCountries(e).includes(countryId)) return false;
    if (fc!=="all" && e.contributor!==fc) return false;
    return true;
  }), [entries, countryId, fc]);

  const totals = useMemo(() => {
    const all = entries.filter(e => getCountries(e).includes(countryId));
    const coins = all.flatMap(e=>e.items).filter(i=>i.type==="coin").length;
    const bills = all.flatMap(e=>e.items).filter(i=>i.type==="bill").length;
    const contribs = [...new Set(all.map(e=>e.contributor))];
    return {coins,bills,contribs};
  }, [entries, countryId]);

  return (
    <div className="ca" style={{position:"absolute",inset:0,zIndex:40}}>
      <div className="ca-chdr">
        <button className="ca-bkbtn" onClick={onClose}>←</button>
        <div style={{flex:1}}>
          <div className="ca-cname">{cinfo.n}</div>
          <div style={{fontSize:13,color:"var(--muted)"}}>{CONTINENTS[cinfo.c]}</div>
        </div>
        <span className={`ca-badge ${totals.coins+totals.bills>0?"ca-bg":"ca-bgray"}`}>
          {totals.coins+totals.bills>0?"✓ Collected":"Not collected"}
        </span>
      </div>

      <div style={{display:"flex",gap:10,padding:"12px 16px",borderBottom:"1px solid var(--sur2)"}}>
        {[{l:"Coins",v:totals.coins,co:"var(--gold)"},{l:"Bills",v:totals.bills,co:"var(--grn)"},{l:"Total",v:totals.coins+totals.bills,co:"var(--txt)"}]
          .map(s=>(
          <div key={s.l} style={{flex:1,textAlign:"center",background:"var(--sur)",borderRadius:8,padding:"8px 4px"}}>
            <div style={{fontFamily:"var(--fd)",fontSize:22,color:s.co,lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>

      <div className="ca-filters">
        {["all","coin","bill"].map(f=>(
          <button key={f} className={`ca-chip ${ft===f?"on":""}`} onClick={()=>setFt(f)}>
            {f==="all"?"All":f==="coin"?"🪙 Coins":"💵 Bills"}
          </button>
        ))}
        {["all",...CONTRIBUTORS].map(c=>(
          <button key={c} className={`ca-chip ${fc===c?"on":""}`} onClick={()=>setFc(c)}>
            {c==="all"?"Everyone":c}
          </button>
        ))}
      </div>

      <div className="ca-page" style={{paddingTop:8,paddingBottom:80}}>
        {relevant.length===0 ? (
          <div className="ca-empty">
            No items yet for {cinfo.n}.
            <br/>
            <button className="ca-btn" style={{marginTop:14,padding:"9px 22px",width:"auto",fontSize:14}}
              onClick={()=>onAdd(countryId)}>+ Add items</button>
          </div>
        ) : (
          relevant.map(entry => {
            const eis = entry.items.filter(i=>ft==="all"||i.type===ft);
            if (!eis.length) return null;
            return (
              <div key={entry.id} style={{marginBottom:16}}>
                <div style={{fontSize:11,color:"var(--muted)",marginBottom:6,textTransform:"uppercase",letterSpacing:".8px"}}>
                  {new Date(entry.date).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})} · {entry.contributor}
                  {entry.isHistorical && <span style={{marginLeft:6,color:"var(--gold)",fontSize:10}}>via {entry.entityName}</span>}
                </div>
                {eis.map(item=>(
                  <div key={item.id} className="ca-ient">
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span className={`ca-badge ${item.type==="coin"?"ca-bcoin":"ca-bbill"}`}>
                        {item.type==="coin"?"🪙":"💵"} {item.type}
                      </span>
                      <span className="ca-idn">{item.denomination}</span>
                    </div>
                    {item.year && <div className="ca-imt">{item.year}</div>}
                    {item.notes && <div className="ca-imt" style={{fontStyle:"italic"}}>{item.notes}</div>}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ===================== STATS PAGE ===================== */
function StatsPage({ entries }) {
  const s = useMemo(() => {
    const byC = new Map();
    entries.forEach(e => {
      getCountries(e).forEach(cid => {
        if (!byC.has(cid)) byC.set(cid,{coins:0,bills:0});
        const inf=byC.get(cid);
        e.items.forEach(it=>{ if(it.type==="coin")inf.coins++;else inf.bills++; });
      });
    });
    const total = Object.keys(CD).length;
    const collected = byC.size;
    const byCont={};
    Object.values(CONTINENTS).forEach(c=>{byCont[c]={t:0,c:0};});
    Object.keys(CD).forEach(id=>{ const cont=CONTINENTS[CD[id]?.c]; if(cont)byCont[cont].t++; });
    byC.forEach((_,cid)=>{ const cont=CONTINENTS[CD[cid]?.c]; if(cont)byCont[cont].c++; });
    const allItems = entries.flatMap(e=>e.items);
    const coins=allItems.filter(i=>i.type==="coin").length;
    const bills=allItems.filter(i=>i.type==="bill").length;
    const byCon={};
    CONTRIBUTORS.forEach(c=>{byCon[c]={countries:new Set(),items:0,coins:0,bills:0};});
    entries.forEach(e=>{
      const cv=byCon[e.contributor]; if(!cv)return;
      getCountries(e).forEach(cid=>cv.countries.add(cid));
      e.items.forEach(it=>{cv.items++;if(it.type==="coin")cv.coins++;else cv.bills++;});
    });
    const top = [...byC.entries()]
      .sort((a,b)=>(b[1].coins+b[1].bills)-(a[1].coins+a[1].bills))
      .slice(0,5)
      .map(([id,inf])=>({name:CD[id]?.n||"?",coins:inf.coins,bills:inf.bills}));
    const hist = entries.filter(e=>e.isHistorical).length;
    return {total,collected,pct:Math.round((collected/total)*100),byCont,coins,bills,byCon,top,hist};
  }, [entries]);

  const Box = ({n,l})=>(
    <div className="ca-scard">
      <div className="ca-snum">{n}</div>
      <div className="ca-slbl">{l}</div>
    </div>
  );

  return (
    <div style={{flex:1,overflowY:"auto",padding:"0 16px 80px"}}>
      <div style={{fontFamily:"var(--fd)",fontSize:24,fontWeight:700,color:"var(--gold)",padding:"16px 0 12px"}}>
        Collection Stats
      </div>
      <div className="ca-sgrid">
        <Box n={s.collected} l="Countries Collected"/>
        <Box n={`${s.pct}%`} l="World Coverage"/>
        <Box n={s.total-s.collected} l="Still to Find"/>
        <Box n={s.coins+s.bills} l="Total Items"/>
        <Box n={s.coins} l="Coins"/>
        <Box n={s.bills} l="Bills"/>
      </div>

      <div style={{background:"var(--sur)",border:"1px solid var(--goldb)",borderRadius:"var(--r)",padding:"14px 16px",marginBottom:12}}>
        <div style={{fontFamily:"var(--fd)",fontSize:16,fontWeight:600,color:"var(--gold)",marginBottom:12}}>By Continent</div>
        {Object.entries(s.byCont).sort((a,b)=>b[1].c-a[1].c).map(([cont,d])=>(
          <div key={cont} className="ca-cbar">
            <div className="ca-cbname">{cont}</div>
            <div className="ca-cbct">{d.c}/{d.t}</div>
            <div className="ca-cbg">
              <div className="ca-cbf" style={{width:d.t?`${(d.c/d.t)*100}%`:"0%"}}/>
            </div>
          </div>
        ))}
      </div>

      <div style={{background:"var(--sur)",border:"1px solid var(--goldb)",borderRadius:"var(--r)",padding:"14px 16px",marginBottom:12}}>
        <div style={{fontFamily:"var(--fd)",fontSize:16,fontWeight:600,color:"var(--gold)",marginBottom:12}}>Collectors</div>
        {CONTRIBUTORS.map(c=>{
          const inf=s.byCon[c];
          return (
            <div key={c} style={{marginBottom:12,paddingBottom:12,borderBottom:"1px solid var(--sur2)"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontFamily:"var(--fd)",fontSize:16}}>{c}</span>
                <span style={{color:"var(--gold)",fontSize:14}}>{inf?.countries.size||0} countries</span>
              </div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                <span className="ca-badge ca-bcoin">{inf?.coins||0} coins</span>
                <span className="ca-badge ca-bbill">{inf?.bills||0} bills</span>
                <span className="ca-badge ca-bgray">{inf?.items||0} total</span>
              </div>
            </div>
          );
        })}
      </div>

      {s.top.length>0 && (
        <div style={{background:"var(--sur)",border:"1px solid var(--goldb)",borderRadius:"var(--r)",padding:"14px 16px",marginBottom:12}}>
          <div style={{fontFamily:"var(--fd)",fontSize:16,fontWeight:600,color:"var(--gold)",marginBottom:12}}>Most Items</div>
          {s.top.map((c,i)=>(
            <div key={c.name} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid var(--sur2)"}}>
              <span style={{fontFamily:"var(--fd)",color:"var(--dim)",minWidth:22}}>{i+1}.</span>
              <span style={{flex:1,fontSize:15}}>{c.name}</span>
              <span className="ca-badge ca-bcoin">{c.coins}🪙</span>
              <span className="ca-badge ca-bbill">{c.bills}💵</span>
            </div>
          ))}
        </div>
      )}

      {s.hist>0 && (
        <div style={{background:"var(--sur)",border:"1px solid var(--goldb)",borderRadius:"var(--r)",padding:"14px 16px",textAlign:"center"}}>
          <div style={{fontFamily:"var(--fd)",fontSize:32,color:"var(--gold)"}}>{s.hist}</div>
          <div style={{fontSize:13,color:"var(--muted)",marginTop:4}}>Historical entity entries (Soviet Union, Yugoslavia…)</div>
        </div>
      )}
    </div>
  );
}

/* ===================== MAIN ===================== */
function CoinAtlasApp({ uid }) {
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState("map");
  const [showAdd, setShowAdd] = useState(false);
  const [selCountry, setSelCountry] = useState(null);
  const [preCountry, setPreCountry] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [filterCon, setFilterCon] = useState("all");
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const saveTimerRef = useRef(null);

  useEffect(() => {
    INJECT_STYLES();
    loadData(uid).then(e => { setEntries(e); setLoaded(true); });
  }, [uid]);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    saveTimerRef.current = setTimeout(() => {
      saveData(uid, entries)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 450);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [entries, loaded, uid]);

  const handleSave = useCallback((entry) => {
    setEntries(prev => {
      return [...prev, entry];
    });
  }, []);

  const handleAddForCountry = useCallback((id) => {
    setPreCountry(id);
    setSelCountry(null);
    setShowAdd(true);
  }, []);

  const collectedCount = useMemo(() => {
    const s=new Set();
    entries.forEach(e=>getCountries(e).forEach(cid=>s.add(cid)));
    return s.size;
  }, [entries]);

  if (!loaded) {
    return (
      <div className="ca" style={{alignItems:"center",justifyContent:"center",gap:12}}>
        <div style={{fontSize:36}}>🪙</div>
        <div style={{fontFamily:"var(--fd)",color:"var(--gold)",fontSize:18}}>Coin Atlas</div>
      </div>
    );
  }

  return (
    <div className="ca" style={{position:"relative"}}>

      {/* MAP PAGE */}
      {page==="map" && (
        <>
          <div className="ca-hdr">
            <div>
              <div className="ca-ttl">Coin Atlas</div>
              <div className="ca-sub">Birkley & Justin's Collection</div>
            </div>
            <div style={{display:"flex",gap:8,pointerEvents:"all"}}>
              <div className="ca-pbadge" onClick={()=>setPage("stats")}>
                {collectedCount} / {Object.keys(CD).length}
              </div>
              <button className="ca-pbadge" onClick={() => signOut(auth)}>
                Sign out
              </button>
            </div>
          </div>
          <div style={{flex:1,display:"flex",flexDirection:"column",paddingTop:70}}>
            <WorldMap
              entries={entries}
              onCountryClick={id=>setSelCountry(id)}
              filterType={filterType}
              filterContributor={filterCon}
            />
            <div className="ca-filters">
              {[["all","🌍 All"],["coin","🪙 Coins"],["bill","💵 Bills"]].map(([v,l])=>(
                <button key={v} className={`ca-chip ${filterType===v?"on":""}`} onClick={()=>setFilterType(v)}>{l}</button>
              ))}
              <div style={{width:1,background:"var(--sur3)",margin:"3px 2px",flexShrink:0}}/>
              {["all",...CONTRIBUTORS].map(c=>(
                <button key={c} className={`ca-chip ${filterCon===c?"on":""}`} onClick={()=>setFilterCon(c)}>
                  {c==="all"?"Everyone":c}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* STATS PAGE */}
      {page==="stats" && (
        <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
          <div style={{padding:"14px 16px 0",borderBottom:"1px solid var(--goldb)"}}>
            <div className="ca-ttl" style={{fontSize:22,marginBottom:8}}>Stats</div>
          </div>
          <StatsPage entries={entries}/>
        </div>
      )}

      {/* COUNTRY DETAIL */}
      {selCountry && (
        <CountryDetail
          countryId={selCountry}
          entries={entries}
          onClose={()=>setSelCountry(null)}
          onAdd={handleAddForCountry}
        />
      )}

      {/* FAB */}
      {!selCountry && (
        <button className="ca-fab" onClick={()=>{ setPreCountry(null); setShowAdd(true); }}>+</button>
      )}

      {/* ADD MODAL */}
      {showAdd && (
        <AddModal
          onClose={()=>{ setShowAdd(false); setPreCountry(null); }}
          onSave={handleSave}
          preCountryId={preCountry}
        />
      )}

      {/* BOTTOM NAV */}
      {!selCountry && (
        <div className="ca-bnav">
          <button className={`ca-nbtn ${page==="map"?"on":""}`} onClick={()=>setPage("map")}>
            <span className="ca-nicon">🗺</span>Map
          </button>
          <button className={`ca-nbtn ${page==="stats"?"on":""}`} onClick={()=>setPage("stats")}>
            <span className="ca-nicon">📊</span>Stats
          </button>
          <button className="ca-nbtn" onClick={() => signOut(auth)}>
            <span className="ca-nicon">⎋</span>Sign out
          </button>
        </div>
      )}
      {saveState !== "idle" && (
        <div style={{position:"absolute",top:78,right:16,zIndex:25,fontSize:12,color:"var(--muted)"}}>
          {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : "Save error"}
        </div>
      )}
    </div>
  );
}

export default function CoinAtlas() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  INJECT_STYLES();

  if (!authReady) {
    return (
      <div className="ca" style={{alignItems:"center",justifyContent:"center",gap:12}}>
        <div style={{fontFamily:"var(--fd)",color:"var(--gold)",fontSize:18}}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="ca" style={{alignItems:"center",justifyContent:"center",padding:"24px"}}>
        <div style={{maxWidth:520,width:"100%",background:"var(--sur)",border:"1px solid var(--goldb)",borderRadius:12,padding:20}}>
          <div className="ca-ttl" style={{marginBottom:8}}>Coin Atlas</div>
          <div className="ca-sub" style={{marginBottom:16}}>
            Sign in with Google to sync your collection with Firebase.
          </div>
          <button className="ca-btn" onClick={() => signInWithPopup(auth, provider).catch(() => undefined)}>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return <CoinAtlasApp uid={user.uid} />;
}
