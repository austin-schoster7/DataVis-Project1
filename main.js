// Set the dimensions of the views
const mapWidth = 800, mapHeight = 500;
const histogramWidth = 600, histogramHeight = 400;
const scatterWidth = 600, scatterHeight = 400;

// Create SVG elements for each view
const svgMap = d3.select("#map").append("svg")
  .attr("width", mapWidth)
  .attr("height", mapHeight);

const svgHist = d3.select("#histogram").append("svg")
  .attr("width", histogramWidth)
  .attr("height", histogramHeight);

const svgScatter = d3.select("#scatterplot").append("svg")
  .attr("width", scatterWidth)
  .attr("height", scatterHeight);

// Define a quantize color scale for the choropleth map
const colorScale = d3.scaleQuantize().range(d3.schemeBlues[9]);

// Define a projection and path generator for the map
const projection = d3.geoAlbersUsa()
  .translate([mapWidth / 2, mapHeight / 2])
  .scale(900);
const path = d3.geoPath().projection(projection);

// Mapping from code names to pretty display names.
const attributeDisplayNames = {
  poverty_perc: "Poverty Percent",
  percent_smoking: "Percent Smoking",
  median_household_income: "Median Household Income",
  percent_stroke: "Percent Stroke",
};

// Global variables to store the data
let countyData;
let us;

// Function to show a tooltip with the given HTML content at the mouse position
function showTooltip(html, event) {
  d3.select("#tooltip")
    .html(html)
    .style("left", (event.pageX + 10) + "px")
    .style("top", (event.pageY + 10) + "px")
    .style("opacity", 1);
}

// Function to hide the tooltip
function hideTooltip() {
  d3.select("#tooltip")
    .style("opacity", 0);
}

// Function to update visualizations when the attribute selection changes
function updateVisualizations(selectedAttr) {
  // Get display names
  const displayName = attributeDisplayNames[selectedAttr] || selectedAttr;
  const secondAttr = "median_household_income";
  const secondDisplayName = attributeDisplayNames[secondAttr] || secondAttr;

  // Format numbers in the legend
  const formatK = d3.format(".2s");

  // Dynamically update the map title
  svgMap.select(".map-title")
    .text("Choropleth Map of " + displayName);

  // Convert the selected attribute to numbers.
  countyData.forEach(d => { d[selectedAttr] = +d[selectedAttr]; });
  colorScale.domain(d3.extent(countyData, d => d[selectedAttr]));

  // === Update Choropleth Map ===
  svgMap.selectAll("path")
  // Set the fill attribute based on the county data
  .attr("fill", d => {
    const countyDatum = countyData.find(cd =>
      String(cd.cnty_fips).padStart(5, '0') === String(d.id).padStart(5, '0')
    );
    return countyDatum ? colorScale(countyDatum[selectedAttr]) : "#ccc";
  })
  // Attach the tooltip event handlers.
  .on("mouseover", (event, d) => {
    // Lookup county data.
    const countyDatum = countyData.find(cd =>
      String(cd.cnty_fips).padStart(5, '0') === String(d.id).padStart(5, '0')
    );
    const countyName = countyDatum && countyDatum.display_name ? countyDatum.display_name : "FIPS: " + d.id;
    const value = countyDatum ? countyDatum[d3.select("#attributeSelect").node().value] : "N/A";
    showTooltip(
      `<strong>${countyName.replaceAll('"', '')}</strong><br>${attributeDisplayNames[d3.select("#attributeSelect").node().value] || d3.select("#attributeSelect").node().value}: ${value}`,
      event
    );
  })
  .on("mousemove", (event) => {
    d3.select("#tooltip")
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY + 10) + "px");
  })
  .on("mouseout", hideTooltip);

  // === Add/Update Map Legend ===
  svgMap.selectAll(".legend").remove();
  // Set legend dimensions and positioning
  const legendWidthMap = 200, legendHeightMap = 10;
  const legendX = mapWidth - legendWidthMap - 20;
  const legendY = mapHeight - 40;

  const legend = svgMap.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${legendX}, ${legendY})`);

  const legendData = colorScale.range().map(color => {
    const extent = colorScale.invertExtent(color);
    return { color: color, extent: extent };
  });

  const legendItemWidth = legendWidthMap / legendData.length;

  legend.selectAll("rect")
    .data(legendData)
    .enter()
    .append("rect")
    .attr("x", (d, i) => i * legendItemWidth)
    .attr("y", 0)
    .attr("width", legendItemWidth)
    .attr("height", legendHeightMap)
    .attr("fill", d => d.color);

  legend.selectAll("text")
    .data(legendData)
    .enter()
    .append("text")
    .attr("x", (d, i) => i * legendItemWidth)
    .attr("y", legendHeightMap + 12)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .text((d) => formatK(d.extent[0]));

  legend.append("text")
    .attr("x", legendWidthMap)
    .attr("y", legendHeightMap + 12)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .text(formatK(legendData[legendData.length - 1].extent[1]));

  // === Update Histogram ===
  const histMargin = {top: 30, right: 20, bottom: 50, left: 70};
  const histInnerWidth = histogramWidth - histMargin.left - histMargin.right;
  const histInnerHeight = histogramHeight - histMargin.top - histMargin.bottom;
  svgHist.selectAll("*").remove();
  svgHist.append("text")
    .attr("class", "chart-title")
    .attr("x", histogramWidth / 2)
    .attr("y", histMargin.top / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .text("Histogram of " + displayName);

  const histGroup = svgHist.append("g")
    .attr("transform", `translate(${histMargin.left}, ${histMargin.top})`);

  const values = countyData.map(d => d[selectedAttr]);

  const histogramGenerator = d3.bin()
    .domain(colorScale.domain())
    .thresholds(10);

  const bins = histogramGenerator(values);

  const xHist = d3.scaleLinear()
    .domain(colorScale.domain())
    .range([0, histInnerWidth]);

  const yHist = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.length)])
    .range([histInnerHeight, 0]);

  histGroup.selectAll("rect")
    .data(bins)
    .enter()
    .append("rect")
    .attr("x", d => xHist(d.x0))
    .attr("y", d => yHist(d.length))
    .attr("width", d => xHist(d.x1) - xHist(d.x0) - 1)
    .attr("height", d => histInnerHeight - yHist(d.length))
    .attr("fill", "steelblue")
    .on("mouseover", (event, d) => {
        showTooltip(
          `<strong>Range:</strong> ${Math.round(d.x0)} - ${Math.round(d.x1)}<br><strong>Count:</strong> ${d.length}`,
          event
        );
      })
      .on("mousemove", (event) => {
        d3.select("#tooltip")
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY + 10) + "px");
      })
    .on("mouseout", hideTooltip);

  histGroup.append("g")
    .attr("transform", `translate(0, ${histInnerHeight})`)
    .call(d3.axisBottom(xHist));

  histGroup.append("g")
    .call(d3.axisLeft(yHist));

  svgHist.append("text")
    .attr("class", "axis-label")
    .attr("x", histogramWidth / 2)
    .attr("y", histogramHeight - 10)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text(displayName);

  histGroup.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -histInnerHeight / 2)
    .attr("y", -histMargin.left + 15)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Frequency");

  // === Update Scatterplot ===
  const scatterMargin = {top: 30, right: 20, bottom: 50, left: 70};
  const scatterInnerWidth = scatterWidth - scatterMargin.left - scatterMargin.right;
  const scatterInnerHeight = scatterHeight - scatterMargin.top - scatterMargin.bottom;

  svgScatter.selectAll("*").remove();

  svgScatter.append("text")
    .attr("class", "chart-title")
    .attr("x", scatterWidth / 2)
    .attr("y", scatterMargin.top / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .text(displayName + " vs. " + secondDisplayName);

  const scatterGroup = svgScatter.append("g")
    .attr("transform", `translate(${scatterMargin.left}, ${scatterMargin.top})`);

  countyData.forEach(d => { d[secondAttr] = +d[secondAttr]; });

  const xScatter = d3.scaleLinear()
    .domain(d3.extent(countyData, d => d[selectedAttr])).nice()
    .range([0, scatterInnerWidth]);

  const yScatter = d3.scaleLinear()
    .domain(d3.extent(countyData, d => d[secondAttr])).nice()
    .range([scatterInnerHeight, 0]);

  scatterGroup.selectAll("circle")
    .data(countyData)
    .enter()
    .append("circle")
    .attr("cx", d => xScatter(d[selectedAttr]))
    .attr("cy", d => yScatter(d[secondAttr]))
    .attr("r", 3)
    .attr("fill", "orange")
    .on("mouseover", (event, d) => {
        // Show selected attribute and median household income
        const selectedAttr = d3.select("#attributeSelect").node().value;
        const displayName = attributeDisplayNames[selectedAttr] || selectedAttr;
        showTooltip(
        `<strong>${d.display_name.replaceAll('"', '')}</strong><br>${displayName}: ${d[selectedAttr]}<br>Median Income: ${d.median_household_income}`,
        event
        );
    })
    .on("mousemove", (event) => {
        d3.select("#tooltip")
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY + 10) + "px");
    })
    .on("mouseout", hideTooltip);

  scatterGroup.append("g")
    .attr("transform", `translate(0, ${scatterInnerHeight})`)
    .call(d3.axisBottom(xScatter));

  scatterGroup.append("g")
    .call(d3.axisLeft(yScatter));

  svgScatter.append("text")
    .attr("class", "axis-label")
    .attr("x", scatterWidth / 2)
    .attr("y", scatterHeight - 10)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text(displayName);
    
  scatterGroup.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -scatterInnerHeight / 2)
    .attr("y", -scatterMargin.left + 15)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text(secondDisplayName);
}

// Draw a static map title (which will be updated dynamically)
svgMap.append("text")
  .attr("class", "map-title")
  .attr("x", mapWidth / 2)
  .attr("y", 20)
  .attr("text-anchor", "middle")
  .style("font-size", "16px")
  .text("US Counties Choropleth Map");

// Load the data
Promise.all([
  d3.json("data/counties-10m.json"),
  d3.csv("data/national_health_data_2024.csv")
]).then(([usData, csvData]) => {
  us = usData;
  countyData = csvData;
  countyData = countyData.filter(d => d.median_household_income >= 0 && d.poverty_perc >= 0 && d.percent_smoking >= 0);

  // Update the color scale domain based on the initial attribute
  svgMap.append("g")
    .selectAll("path")
    .data(topojson.feature(us, us.objects.counties).features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5)
    .on("mouseover", (event, d) => {
      const countyDatum = countyData.find(cd =>
        String(cd.cnty_fips).padStart(5, '0') === String(d.id).padStart(5, '0')
      );
      console.log("Map county:", countyDatum);
    });
  const defaultAttr = d3.select("#attributeSelect").node().value;

  // Initial update of visualizations and update each time the dropdown changes
  updateVisualizations(defaultAttr);
  d3.select("#attributeSelect").on("change", function() {
    const selectedAttr = this.value;
    updateVisualizations(selectedAttr);
  });
}).catch(error => {
  console.error("Error loading data: ", error);
});
