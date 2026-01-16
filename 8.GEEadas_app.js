// =============================================================================
// Corn Frost App - Parana 2021
// =============================================================================
// This application visualizes the impact of frost events on second-crop corn in Western Paraná.
// It uses a classification map derived from Sentinel-2 imagery and allows users to explore
// the temporal evolution of NDVI for specific pixels.
//
// Key Features:
// 1. Split Panel Layout: Frost Classification (Left) vs. Sentinel-2 Imagery (Right).
// 2. Interactive Charting: Click on any map to see the NDVI time series.
// 3. Dynamic Visualization: Chart lines change color based on the pixel's class (Harvested, Frost, etc.).
// 4. Frost Event Marking: Vertical lines indicate the exact dates of frost events on the chart.
//
// Data Source: projects/ee-victorohden/assets/GEEadas/GEEadas_Corn_Forst_PR
// =============================================================================

// --- 1. Data Setup ---

// Define the path to the classification asset.
var assetPath = "projects/ee-victorohden/assets/GEEadas/GEEadas_Corn_Forst_PR";

// Load the image.
// Band 0: Corn Mask (2 = Corn, 1 = No Corn/Other).
// Band 1: Frost Classification (1 = Harvested, 2 = Frost May 25, 3 = Frost June 30, 4 = Not Affected).
var frostImage = ee.Image(assetPath);
var cornBand = frostImage.select(0);
var frostBand = frostImage.select(1);

// Visualization Parameters
// Create a mask to only show areas classified as Corn (Value 2).
var cornMask = cornBand.eq(2);

// Define visual parameters for the frost classes.
var frostVis = {
    min: 1,
    max: 4,
    palette: ['#00FFFF', '#FF00FF', '#0000FF', '#008000']
    // 1: Cyan (Harvested)
    // 2: Magenta (Frost Event: May 25)
    // 3: Blue (Frost Event: June 30)
    // 4: Green (Not Affected)
};

// Apply the corn mask to the frost band for display.
var frostLayer = frostBand.updateMask(cornMask);

// Load the Sentinel-2 Harmonized collection (Surface Reflectance).
// We filter bounds early to optimize performance.
var s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(frostImage.geometry());

// Helper function to define common visualization parameters for S2 images.
// Scales data (0-3000 -> 0-0.3 reflectance) and applies gamma correction.
function getVisParams(bands) {
    return { min: 0, max: 3000, bands: bands, gamma: 1.4 };
}


// --- 2. UI Layout Setup (Split Panel) ---

// We use a SplitPanel to allow side-by-side comparison of the classification map
// and actual satellite imagery.

// Create two standard map widgets.
var leftMap = ui.Map();
var rightMap = ui.Map();

// Link the maps so that zooming/panning one affects the other.
var linker = ui.Map.Linker([leftMap, rightMap]);

// Create the SplitPanel widget.
var splitPanel = ui.SplitPanel({
    firstPanel: leftMap,
    secondPanel: rightMap,
    orientation: 'horizontal',
    wipe: true, // Enables the sliding "wipe" effect.
    style: { stretch: 'both' }
});

// Create a side panel for the Legend, Description, and Chart.
var sidePanel = ui.Panel({
    style: { width: '400px', padding: '8px' }
});

// Clear the default root and add our custom layout.
ui.root.clear();
ui.root.add(splitPanel);
ui.root.add(sidePanel);


// --- 3. Map Configuration ---

// Left Map Configuration: Frost Classification
leftMap.setOptions('ROADMAP'); // Clean roadmap background to emphasize colors.
leftMap.style().set('cursor', 'crosshair'); // Crosshair for precision clicking.
leftMap.setCenter(-53.5, -24.5, 9); // Initial center (Western Paraná).
leftMap.addLayer(frostLayer, frostVis, 'Corn Frost Classification');
leftMap.setControlVisibility({ layerList: false }); // Hide layer controls to keep UI clean.

// Right Map Configuration: Sentinel-2 Imagery
rightMap.setOptions('HYBRID'); // Satellite background for context.
rightMap.style().set('cursor', 'crosshair');

// Define specific dates of interest (based on the research paper/study context).
// These dates capture pre-frost, frost, and post-frost conditions.
var dates = [
    '2021-03-16',
    '2021-04-20',
    '2021-06-04',
    '2021-07-09',
    '2021-07-29'
];

// Iterate through the dates to add layers to the Right Map.
dates.forEach(function (date, index) {
    var d = ee.Date(date);
    // Filter S2 collection for exactly this date (using a 1-day window).
    var img = s2.filterDate(d, d.advance(1, 'day'))
        .mosaic(); // Mosaic handles cases where the ROI spans multiple tiles.

    // Add RGB (True Color) Layer.
    // Only the first date (March 16) is shown by default. Others are added but hidden.
    var show = (index === 0);
    rightMap.addLayer(img, getVisParams(['B4', 'B3', 'B2']), date + ' (RGB)', show);

    // Add False Color Layer (NIR/SWIR/Red) for vegetation analysis. Hidden by default.
    rightMap.addLayer(img, getVisParams(['B8', 'B11', 'B4']), date + ' (False Color)', false);
});


// --- 4. Sidebar Content ---
// This section builds the descriptive right-hand panel.

var header = ui.Label('Corn Frost Mapping - Paraná 2021', { fontSize: '20px', fontWeight: 'bold' });
var subheader = ui.Label('Impact of frost events on second crop corn.', { fontSize: '14px', color: 'gray' });

// Create a rich description using a clean panel layout.
var descPanel = ui.Panel();
descPanel.add(ui.Label(
    'This application visualizes the impact of two major frost events (May 25th and June 30th, 2021) on corn crops in Western Paraná. Click on a pixel to view the Sentinel-2 time series. Click on the graph to see more images.',
    { fontSize: '12px', fontWeight: 'bold', color: 'black' }
));
descPanel.add(ui.Label(
    'This study utilizes high-resolution Sentinel-2 imagery to map and assess the severity of frost events on second-crop corn, distinguishing between harvested, affected, and unaffected areas.',
    { fontSize: '12px', color: 'black', margin: '4px 0 0 0' }
));
var description = descPanel;

// Create the Legend
var legendPanel = ui.Panel({ style: { padding: '8px', border: '1px solid #ddd' } });

// Helper function to create a single row in the legend (Color Box + Name).
function makeLegendRow(color, name) {
    var colorBox = ui.Label({
        style: {
            backgroundColor: color,
            padding: '8px',
            margin: '0 0 4px 0'
        }
    });
    var desc = ui.Label({ value: name, style: { margin: '0 0 4px 6px' } });
    return ui.Panel({ widgets: [colorBox, desc], layout: ui.Panel.Layout.Flow('horizontal') });
}

// Add legend items matching the 'frostVis' palette.
legendPanel.add(makeLegendRow('#00FFFF', 'Harvested'));
legendPanel.add(makeLegendRow('#FF00FF', 'Frost Event: May 25'));
legendPanel.add(makeLegendRow('#0000FF', 'Frost Event: June 30'));
legendPanel.add(makeLegendRow('#008000', 'Not Affected'));

// Add External Links
var paperLink = ui.Label('Read the Paper (ScienceDirect)', { fontSize: '11px', color: 'blue' }, 'https://www.sciencedirect.com/science/article/pii/S2352938525003520');
var datasetLink1 = ui.Label('Download Classification Dataset (Zenodo)', { fontSize: '11px', color: 'blue' }, 'https://zenodo.org/records/18167593');
var datasetLink2 = ui.Label('Download Frost Dataset (Zenodo)', { fontSize: '11px', color: 'blue' }, 'https://zenodo.org/records/18245506');

// Placeholder Panel for the Chart (initially hidden)
var chartPanel = ui.Panel({
    style: {
        shown: false,
        margin: '10px 0 0 0',
        border: '1px solid #ddd',
        padding: '5px'
    }
});

// Assemble the Side Panel
sidePanel.add(header);
sidePanel.add(subheader);
sidePanel.add(description);
sidePanel.add(ui.Label('Legend', { fontWeight: 'bold', margin: '10px 0 0 0' }));
sidePanel.add(legendPanel);
sidePanel.add(ui.Label('References:', { fontWeight: 'bold', margin: '20px 0 5px 0' }));
sidePanel.add(paperLink);
sidePanel.add(datasetLink1);
sidePanel.add(datasetLink2);
sidePanel.add(chartPanel);


// --- 5. Interaction Logic ---
// Handles map clicks to generate time-series charts.

function showTimeSeries(coords) {
    // Reset Chart Panel state
    chartPanel.clear();
    chartPanel.style().set('shown', true);
    chartPanel.add(ui.Label('Loading chart...', { color: 'gray' }));

    var point = ee.Geometry.Point([coords.lon, coords.lat]);

    // Add a Red Dot marker to BOTH maps to indicate selection.
    // Note: We create separate UI objects for each map to avoid "Component already rendered" errors.
    var dotLeft = ui.Map.Layer(point, { color: 'red' }, 'Clicked Point');
    var dotRight = ui.Map.Layer(point, { color: 'red' }, 'Clicked Point');
    leftMap.layers().set(leftMap.layers().length(), dotLeft);
    rightMap.layers().set(rightMap.layers().length(), dotRight);

    // Prepare S2 Collection for the Chart.
    // Filter by bounds and date range covering the study period (2020-2021).
    var s2_chart = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(point)
        .filterDate('2020-09-01', '2021-10-31')
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 60)); // initial cloud filter

    // Cloud Masking Function for Sentinel-2 (QA60 band).
    function maskS2clouds(image) {
        var qa = image.select('QA60');
        var cloudBitMask = 1 << 10;
        var cirrusBitMask = 1 << 11;
        var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
            .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
        return image.updateMask(mask).divide(10000).copyProperties(image, ['system:time_start']);
    }
    s2_chart = s2_chart.map(maskS2clouds);

    // Calculate NDVI for the chart.
    var s2_ndvi = s2_chart.map(function (img) {
        return img.normalizedDifference(['B8', 'B4']).rename('NDVI')
            .copyProperties(img, ['system:time_start']);
    });

    // Reduce the Frost/Corn image at the clicked point to determine its class.
    // We use 'first' reducer with a small scale.
    frostImage.select([0, 1]).rename(['Corn', 'Frost']).reduceRegion({
        reducer: ee.Reducer.first(),
        geometry: point,
        scale: 10,
        maxPixels: 1e9
    }).evaluate(function (result) {
        // Client-side callback to handle the reduction result.

        var cornVal = result['Corn'];
        var frostVal = result['Frost'];

        var combinedCol = s2_ndvi;
        var statusText = "";
        var lineColor = 'black'; // Default line color

        // Determine Status and Color based on Classification
        var isCorn = (cornVal === 2);

        if (!isCorn) {
            statusText = "No corn mask";
            lineColor = 'black';
        } else {
            // It is Corn area, check Frost Class
            if (frostVal === 1) {
                statusText = "Harvested";
                lineColor = '#00FFFF'; // Cyan
            } else if (frostVal === 2) {
                statusText = "Affected by Frost: May 25";
                lineColor = '#FF00FF'; // Magenta
            } else if (frostVal === 3) {
                statusText = "Affected by Frost: June 30";
                lineColor = '#0000FF'; // Blue
            } else if (frostVal === 4) {
                statusText = "Not Affected";
                lineColor = '#008000'; // Green
            } else {
                statusText = "Unknown Class";
                lineColor = 'gray';
            }
        }

        // Check if we need to display a vertical Frost Marker line.
        // This applies only if it's a known Frost Event class (2 or 3).
        var isFrostEvent = (isCorn && (frostVal === 2 || frostVal === 3));

        var seriesOptions = {};
        var bandsToSelect = [];

        if (isFrostEvent) {
            // Logic to create a vertical line on the specific frost date.
            // We create two dummy images: one at Value 0, one at Value 1, separated by 1 hour.
            // This draws a near-vertical line on the time series.

            var d = (frostVal === 2) ? '2021-05-25' : '2021-06-30';
            var t1 = ee.Date(d).millis();
            var t2 = ee.Date(d).advance(1, 'hour').millis();

            var frostImg1 = ee.Image.constant(0).rename('FrostMarker')
                .addBands(ee.Image.constant(0).mask(0).rename('NDVI')) // Mask NDVI to avoid plotting data
                .set('system:time_start', t1);

            var frostImg2 = ee.Image.constant(1).rename('FrostMarker')
                .addBands(ee.Image.constant(0).mask(0).rename('NDVI'))
                .set('system:time_start', t2);

            var frostLineCol = ee.ImageCollection([frostImg1, frostImg2]);

            // Add an empty 'FrostMarker' band to the main S2 collection so merging works.
            combinedCol = combinedCol.map(function (img) {
                return img.addBands(ee.Image.constant(0).mask(0).rename('FrostMarker'));
            });
            // Merge the S2 data with the manual Frost Line data.
            combinedCol = combinedCol.merge(frostLineCol).sort('system:time_start');

            bandsToSelect = ['FrostMarker', 'NDVI'];

            // Series 0: FrostMarker (Black vertical line)
            // Series 1: NDVI (Colored line based on class)
            seriesOptions = {
                0: { color: 'black', lineWidth: 1, pointSize: 0, type: 'line', targetAxisIndex: 1, labelInLegend: 'Frost Event' },
                1: { color: lineColor, lineWidth: 2, pointSize: 3, type: 'line', targetAxisIndex: 0, labelInLegend: 'NDVI' }
            };
        } else {
            // Non-Frost OR No-Corn: Process NDVI only.
            bandsToSelect = ['NDVI'];

            // Series 0: NDVI (Since only 1 band is selected, it becomes Series 0)
            seriesOptions = {
                0: { color: lineColor, lineWidth: 2, pointSize: 3, type: 'line', targetAxisIndex: 0, labelInLegend: 'NDVI' }
            };
        }

        // Construct Chart Title
        var titleStr = 'Sentinel-2 NDVI | ' + statusText + ' | Lat: ' + coords.lat.toFixed(4) + ' Lon: ' + coords.lon.toFixed(4);

        // Generate the Chart
        var chart = ui.Chart.image.series({
            imageCollection: combinedCol.select(bandsToSelect),
            region: point,
            reducer: ee.Reducer.mean(),
            scale: 10
        }).setOptions({
            title: titleStr,
            vAxes: {
                0: { title: 'NDVI', viewWindow: { min: 0, max: 1 } },
                1: { viewWindow: { min: 0, max: 1 }, textPosition: 'none' } // Secondary axis for the vertical line (0-1)
            },
            hAxis: { title: 'Date', format: 'MMM yy' },
            series: seriesOptions,
            interpolateNulls: true
        });

        // Add Chart Click Listener
        // Clicking on the chart loads specific satellite images on the map.
        chart.onClick(function (xValue) {
            if (!xValue) return;

            // Convert clicked date to EE Date and String.
            var dateDate = new Date(xValue);
            var dateStr = dateDate.toISOString().split('T')[0];
            var dateEE = ee.Date(xValue);

            // Fetch the specific S2 image for that date.
            var img = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(point)
                .filterDate(dateEE, dateEE.advance(1, 'day'))
                .first();

            var rgbVis = { bands: ['B4', 'B3', 'B2'], min: 0, max: 3000, gamma: 1.4 };

            // Add interactions to the RIGHT MAP (Satellite view).
            rightMap.addLayer(img, rgbVis, 'Clicked Date RGB (' + dateStr + ')');

            // Optionally add False Color (commented out or active as needed)
            var falseVis = { bands: ['B8', 'B11', 'B4'], min: 0, max: 3000, gamma: 1.4 };
            rightMap.addLayer(img, falseVis, 'Clicked Date False Color (' + dateStr + ')');
        });

        // Display the chart
        chartPanel.clear();
        chartPanel.add(chart);

        // Add "See in Google Maps" link
        var gmapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + coords.lat + ',' + coords.lon;
        chartPanel.add(ui.Label('See in Google Maps', { margin: '5px 0 0 0', fontSize: '12px', color: 'blue' }, gmapsUrl));

        chartPanel.add(ui.Button('Close Chart', function () { chartPanel.style().set('shown', false); }));
    });
}

// Bind the click handler to both maps.
leftMap.onClick(showTimeSeries);
rightMap.onClick(showTimeSeries);
