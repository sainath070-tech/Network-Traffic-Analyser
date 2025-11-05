
let networkData = [
  { timestamp: new Date(Date.now() - 60_000 * 4), source: "192.168.0.1", destination: "192.168.0.2", size: 150 },
  { timestamp: new Date(Date.now() - 60_000 * 3), source: "192.168.0.2", destination: "192.168.0.3", size: 200 },
  { timestamp: new Date(Date.now() - 60_000 * 2), source: "192.168.0.3", destination: "192.168.0.4", size: 90 },
  { timestamp: new Date(Date.now() - 60_000 * 1), source: "192.168.0.4", destination: "192.168.0.5", size: 260 },
  { timestamp: new Date(), source: "192.168.0.5", destination: "192.168.0.1", size: 130 },
];

const container = d3.select("#traffic-chart");
container.selectAll("*").remove();

const margin = { top: 16, right: 12, bottom: 30, left: 60 };
let width = 800 - margin.left - margin.right;
let height = 320 - margin.top - margin.bottom;


const bounding = container.node().getBoundingClientRect();
width = Math.max(400, bounding.width - margin.left - margin.right);

const svg = container
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3.scaleTime().range([0, width]);
const y = d3.scaleLinear().range([height, 0]);

const xAxisG = svg.append("g").attr("transform", `translate(0,${height})`);
const yAxisG = svg.append("g");

const area = d3.area().x(d => x(d.timestamp)).y0(height).y1(d => y(d.size)).curve(d3.curveMonotoneX);
const line = d3.line().x(d => x(d.timestamp)).y(d => y(d.size)).curve(d3.curveMonotoneX);

svg.append("path").attr("class", "area");
svg.append("path").attr("class", "line").attr("fill", "none");

const tooltip = d3.select("body").append("div").attr("class", "d3-tooltip").style("display","none");
const hoverCircle = svg.append("circle").attr("r",4).style("display","none");

// helpers
function normalize(data){ return (data||[]).map(d=>({ ...d, timestamp: new Date(d.timestamp) })).sort((a,b)=>a.timestamp-b.timestamp); }

function aggregateByMinute(data){
  if(!data.length) return [];
  const map = new Map();
  data.forEach(d=>{
    const key = new Date(d.timestamp); key.setSeconds(0,0);
    const k = key.getTime();
    const prev = map.get(k) || { timestamp: new Date(k), size: 0, packets: 0, source: null, destination: null };
    prev.size += d.size;
    prev.packets += 1;
    map.set(k, prev);
  });
  return Array.from(map.values()).sort((a,b)=>a.timestamp-b.timestamp);
}

function render(rawData, { aggregate=false } = {}){
  let data = normalize(rawData);
  if(aggregate) data = aggregateByMinute(data);

  if(!data.length){
    x.domain([new Date(), new Date()]);
    y.domain([0,1]);
    xAxisG.call(d3.axisBottom(x));
    yAxisG.call(d3.axisLeft(y));
    svg.select(".line").attr("d", null);
    svg.select(".area").attr("d", null);
    d3.select("#packet-list-ul").html("");
    return;
  }

  x.domain(d3.extent(data, d => d.timestamp));
  y.domain([0, d3.max(data, d => d.size) * 1.1]);

  xAxisG.transition().call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat("%H:%M:%S")));
  yAxisG.transition().call(d3.axisLeft(y).ticks(5));

  svg.select(".area").datum(data).transition().attr("d", area);
  svg.select(".line").datum(data).transition().attr("d", line);

  // point circles for hover
  const pts = svg.selectAll(".pt").data(data, d => d.timestamp.getTime());
  pts.exit().remove();
  pts.enter().append("circle")
    .attr("class","pt")
    .attr("r",4)
    .style("opacity",0)
    .on("mouseover", function(event,d){
      hoverCircle.style("display",null).attr("cx",x(d.timestamp)).attr("cy",y(d.size));
      tooltip.style("display","block")
        .html(`<strong>${d.timestamp.toLocaleString()}</strong><br/>${d.size} bytes<br/>${d.source||''} → ${d.destination||''}`)
        .style("left", (event.pageX+10)+"px")
        .style("top", (event.pageY-28)+"px");
    })
    .on("mousemove", function(event){ tooltip.style("left", (event.pageX+10)+"px").style("top", (event.pageY-28)+"px"); })
    .on("mouseout", function(){ hoverCircle.style("display","none"); tooltip.style("display","none"); })
    .merge(pts)
    .transition()
    .attr("cx", d => x(d.timestamp))
    .attr("cy", d => y(d.size));

  // packet list
  const list = d3.select("#packet-list-ul").selectAll("li").data(data, d => d.timestamp.getTime());
  list.exit().remove();
  list.enter().append("li")
    .merge(list)
    .html(d => `<strong>${d.timestamp.toLocaleTimeString()}</strong>: ${d.source||''} → ${d.destination||''}, ${d.size} bytes`);
}

// incremental update helper (returns new combined array)
function update(existingData, newPackets = [], opts = {}){
  const combined = existingData.concat(newPackets);
  render(combined, opts);
  return combined;
}

// initial render
render(networkData);

setInterval(()=>{
  const pkt = {
    timestamp: new Date(),
    source: `192.168.0.${Math.ceil(Math.random()*10)}`,
    destination: `192.168.0.${Math.ceil(Math.random()*10)}`,
    size: Math.floor(Math.random()*400)+40
  };
  networkData = update(networkData, [pkt], { aggregate: false });

  if(networkData.length > 200) networkData = networkData.slice(networkData.length - 200);
}, 2000);
