// Set the dimensions of the views
const mapWidth = 800, mapHeight = 500;
const histogramWidth = 600, histogramHeight = 400;
const scatterWidth = 600, scatterHeight = 400;

// Global set to store brushed county FIPS codes
let brushedIDs = new Set();

// Global set to store FIPS codes of counties that have been clicked
let selectedIDs = new Set();

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

const colorSchemes = {
  poverty_perc: d3.schemeBlues[9],
  percent_smoking: d3.schemeOranges[9],
  median_household_income: d3.schemeGreens[9],
  percent_stroke: d3.schemePurples[9]
};

const mapGroup = svgMap.append("g")
    .attr("class", "county-group");

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

function updateHighlights(selectedAttr) {
  if (!selectedAttr) selectedAttr = d3.select("#attributeSelect").node().value;

  // Combine clicked (selectedIDs) and brushed (brushedIDs) selections
  let effectiveIDs = new Set([...selectedIDs, ...brushedIDs]);

  // --- Update Map ---
  svgMap.selectAll("path")
    .attr("opacity", d => {
      const countyDatum = countyData.find(cd =>
        String(cd.cnty_fips).padStart(5, '0') === String(d.id).padStart(5, '0')
      );
      // If nothing is selected, show full opacity.
      if (effectiveIDs.size === 0) return 1;
      return countyDatum && effectiveIDs.has(String(countyDatum.cnty_fips).padStart(5, '0')) ? 1 : 0.2;
    });

  // --- Update Scatterplot ---
  svgScatter.selectAll("circle")
    .attr("opacity", d => {
      if (effectiveIDs.size === 0) return 1;
      return effectiveIDs.has(String(d.cnty_fips).padStart(5, '0')) ? 1 : 0.2;
    })
    .attr("fill", d => {
      const fips = String(d.cnty_fips).padStart(5, '0');
      // Clicked counties are red unless the attribute is percent_smoking which is blue for visibility
      if (selectedIDs.has(fips) || brushedIDs.has(fips)) {
        if (selectedAttr === "percent_smoking") return "blue";
        return "red";
      }
      //if (brushedIDs.has(fips)) return colorSchemes[selectedAttr][6];
      return colorSchemes[selectedAttr][6];
    })
    .each(function(d) {
      const fips = String(d.cnty_fips).padStart(5, '0');
      // Raise circles that are clicked/brushed so they are on top
      if (selectedIDs.has(fips) || brushedIDs.has(fips)) {
        d3.select(this).raise();
      }
    });

  // --- Update Histogram ---
  svgHist.selectAll("rect")
    // .attr("opacity", b => {
    //   if (effectiveIDs.size === 0) return 1;
    //   for (const fips of effectiveIDs) {
    //     const countyDatum = countyData.find(cd =>
    //       String(cd.cnty_fips).padStart(5, '0') === fips
    //     );
    //     if (countyDatum && countyDatum[selectedAttr] >= b.x0 && countyDatum[selectedAttr] <= b.x1) {
    //       return 1;
    //     }
    //   }
    //   return 0.2;
    // })
    .attr("fill", b => {
      if (b.isSelected && selectedAttr === "percent_smoking") return "blue";
      else if (b.isSelected) return "red";
      return colorSchemes[selectedAttr][6];
    });

}

function brushedOnMap(event) {
  if (!event.selection) {
    // brush cleared
    brushedIDs.clear();
    updateHighlights();
    return;
  }
  
  const [[x0, y0], [x1, y1]] = event.selection;
  brushedIDs = new Set();
  
  mapGroup.selectAll("path").each(d => {
    const [cx, cy] = d.centroid;
    if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) {
      brushedIDs.add(String(d.id).padStart(5, '0'));
    }
  });
  
  updateHighlights();
}

// Function to update visualizations when the attribute selection changes
function updateVisualizations(selectedAttr, scatterY) {
  // Get display names
  const displayName = attributeDisplayNames[selectedAttr] || selectedAttr;
  const secondAttr = scatterY || "median_household_income";
  const secondDisplayName = attributeDisplayNames[secondAttr] || secondAttr;

  // Get the color scheme for the selected attribute
  const chosenScheme = colorSchemes[selectedAttr] || d3.schemeBlues[9]; 

  // Format numbers in the legend
  const formatK = d3.format(".2s");

  // Dynamically update the map title
  svgMap.select(".map-title")
    .text("Choropleth Map of " + displayName);

  // Convert the selected attribute to numbers.
  countyData.forEach(d => { d[selectedAttr] = +d[selectedAttr]; });

  // Make a new color scale each time based on which attribute is selected:
  const colorScale = d3.scaleQuantize()
    .range(chosenScheme)
    .domain(d3.extent(countyData, d => d[selectedAttr]));

    
  // === Update Choropleth Map ===
  svgMap.selectAll("path")
  // Set the fill attribute based on the county data
  .attr("fill", d => {
    const countyDatum = countyData.find(cd =>
      String(cd.cnty_fips).padStart(5, '0') === String(d.id).padStart(5, '0')
    );
    // If no data or it's NaN, show gray (or whatever color you prefer)
    if (!countyDatum || isNaN(countyDatum[selectedAttr])) {
      return "#ccc";
    }
    return countyDatum ? colorScale(countyDatum[selectedAttr]) : "#ccc";
  })
  .style("cursor", "pointer")
  // Attach the tooltip event handlers.
  .on("mouseover", (event, d) => {
    // Lookup county data.
    const countyDatum = countyData.find(cd =>
      String(cd.cnty_fips).padStart(5, '0') === String(d.id).padStart(5, '0')
    );
    const countyName = countyDatum?.display_name ?? "FIPS: " + d.id;
    let value = "N/A";
    if (countyDatum && !isNaN(countyDatum[selectedAttr])) {
      value = countyDatum[selectedAttr];
    }
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
  .on("mouseout", hideTooltip)
  .on("click", (event, d) => {
    // Toggle the clicked county on the map.
    const countyDatum = countyData.find(cd =>
      String(cd.cnty_fips).padStart(5, '0') === String(d.id).padStart(5, '0')
    );
    if (!countyDatum) return;
    const fips = String(countyDatum.cnty_fips).padStart(5, '0');
    if (selectedIDs.has(fips)) {
      selectedIDs.delete(fips);
    } else {
      selectedIDs.add(fips);
    }
    updateHighlights(selectedAttr);
    event.stopPropagation();
  });

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
    .attr("fill", d => d.color)
    .style("cursor", "pointer")
    .on("click", (event, bin) => {
      const currentAttr = d3.select("#attributeSelect").node().value;
      const [rangeMin, rangeMax] = bin.extent;
  
      // Collect all counties in this bin’s numeric range
      let binCounties = new Set();
      countyData.forEach(d => {
        const val = d[currentAttr];
        if (val >= rangeMin && val <= rangeMax) {
          binCounties.add(String(d.cnty_fips).padStart(5,"0"));
        }
      });
  
      // Check if *every* county in the bin is already selected
      let allAlreadySelected = true;
      for (const fips of binCounties) {
        if (!selectedIDs.has(fips)) {
          allAlreadySelected = false;
          break;
        }
      }
  
      // Toggle: If all are currently selected, remove them. Otherwise add them.
      if (allAlreadySelected) {
        for (const fips of binCounties) {
          selectedIDs.delete(fips);
        }
      } 
      else {
        for (const fips of binCounties) {
          selectedIDs.add(fips);
        }
      }
  
      // Re-apply highlights
      updateHighlights(currentAttr);
    });

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

  bins.forEach(bin => {
    bin.isSelected = false;
  });

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
    .style("cursor", "pointer")
    .attr("fill", b => {
      if (b.isSelected && selectedAttr === "percent_smoking") return "blue";
      else if (b.isSelected) return "red";
      return colorSchemes[selectedAttr][6];
    })
    .on("mouseover", (event, d) => {
        showTooltip(
          `<strong>Range:</strong> ${d.x0} - ${d.x1}<br><strong>Count:</strong> ${d.length}`,
          event
        );
      })
      .on("mousemove", (event) => {
        d3.select("#tooltip")
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY + 10) + "px");
      })
    .on("mouseout", hideTooltip)
    .on("click", (event, bin) => {
      // Toggle the selection state of the bin
      bin.isSelected = !bin.isSelected;
  
      // Clear all selections
      selectedIDs.clear();
      
      const currentAttr = d3.select("#attributeSelect").node().value;
      bins.forEach(b => {
        if (b.isSelected) {
          // For each selected bin, add all counties in that bin’s range
          const rangeMin = b.x0;
          const rangeMax = b.x1;
          countyData.forEach(d => {
            const val = d[currentAttr];
            if (val >= rangeMin && val <= rangeMax) {
              selectedIDs.add(String(d.cnty_fips).padStart(5, '0'));
            }
          });
        }
      });
  
      // Update the highlights in all views
      updateHighlights(currentAttr);
  
      // Update the fill of the histogram bars
      histGroup.selectAll("rect")
        .attr("fill", b => {
          if (b.isSelected && selectedAttr === "percent_smoking") return "blue";
          else if (b.isSelected) return "red";
          return colorSchemes[selectedAttr][6];
        });
    });

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

  // Filter out data points with missing values for the selected attribute
  const filteredData = countyData.filter(d =>
    !isNaN(d[selectedAttr]) && !isNaN(d.median_household_income)
  );  

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

  filteredData.forEach(d => { d[secondAttr] = +d[secondAttr]; });

  const xScatter = d3.scaleLinear()
    .domain(d3.extent(filteredData, d => d[selectedAttr])).nice()
    .range([0, scatterInnerWidth]);

  const yScatter = d3.scaleLinear()
    .domain(d3.extent(filteredData, d => d[secondAttr])).nice()
    .range([scatterInnerHeight, 0]);

  scatterGroup.selectAll("circle")
    .data(filteredData)
    .enter()
    .append("circle")
    .attr("cx", d => xScatter(d[selectedAttr]))
    .attr("cy", d => yScatter(d[secondAttr]))
    .attr("r", 3)
    .attr("fill", colorSchemes[selectedAttr][6])
    .style("cursor", "pointer")
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
    .on("mouseout", hideTooltip)
    .on("click", (event, d) => {
      // Toggle the clicked county.
      const fips = String(d.cnty_fips).padStart(5, '0');
      if (selectedIDs.has(fips)) {
        selectedIDs.delete(fips);
      } else {
        selectedIDs.add(fips);
      }
      updateHighlights(selectedAttr);
      // Stop the event from propagating (so it doesn't interfere with brushing)
      event.stopPropagation();
    });

  // --- Add Brush to Scatterplot ---
  const brush = d3.brush()
    .extent([[0, 0], [scatterInnerWidth, scatterInnerHeight]])
    .on("brush end", brushed);

  scatterGroup.call(brush);

  // Lets you use the brush and still see the tooltip
  scatterGroup.select(".overlay").lower();

  function brushed({ selection }) {
  // If there is a brush selection...
  if (selection) {
    const [[x0, y0], [x1, y1]] = selection;
    brushedIDs = new Set(
      countyData.filter(d => {
        // Get scatterplot coordinates for this point
        const cx = xScatter(d[selectedAttr]);
        const cy = yScatter(d[secondAttr]);
        return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
      }).map(d => String(d.cnty_fips).padStart(5, '0'))
    );
  } else {
    brushedIDs.clear();
  }
    updateHighlights(selectedAttr);
  }

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

  // Update highlights
  updateHighlights(selectedAttr);
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

  csvData.forEach(d => {
    // Convert to Number
    d.median_household_income = +d.median_household_income;
    d.poverty_perc = +d.poverty_perc;
    d.percent_smoking = +d.percent_smoking;
  
    // If < 0, set to NaN (so we can show "N/A" instead of removing county)
    if (d.median_household_income < 0) d.median_household_income = NaN;
    if (d.poverty_perc < 0) d.poverty_perc = NaN;
    if (d.percent_smoking < 0) d.percent_smoking = NaN;
    if (d.percent_stroke < 0) d.percent_stroke = NaN;
  });

  countyData = csvData;

  // Update the color scale domain based on the initial attribute
  mapGroup.selectAll("path")
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
    })
    .each(function(d) {
      d.centroid = path.centroid(d);
    });

  const mapBrush = d3.brush()
    .extent([[0, 0], [mapWidth, mapHeight]])
    .on("brush end", brushedOnMap);

  mapGroup.call(mapBrush);
  mapGroup.select(".overlay")
    .style("pointer-events", "all")
    .style("fill", "none")
    .lower();

  const defaultAttr = d3.select("#attributeSelect").node().value;
  const defaultSecondAttr = d3.select("#scatterY").node().value;

  // Initial update of visualizations and update each time the dropdown changes
  updateVisualizations(defaultAttr, defaultSecondAttr);
  d3.select("#attributeSelect").on("change", function() {
    const selectedAttr = this.value;
    const scatterY = d3.select("#scatterY").node().value;
    updateVisualizations(selectedAttr, scatterY);
  });
  d3.select("#scatterY").on("change", function() {
    const scatterY = this.value;
    const selectedAttr = d3.select("#attributeSelect").node().value;
    updateVisualizations(selectedAttr, scatterY);
  });
}).catch(error => {
  console.error("Error loading data: ", error);
});

d3.select("#clearSelections").on("click", () => {
  selectedIDs.clear();
  brushedIDs.clear();
  svgHist.selectAll("rect").each(b => b.isSelected = false);
  updateHighlights(d3.select("#attributeSelect").node().value);
});

