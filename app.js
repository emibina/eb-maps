let map;
let lapPolylines = []; // Array to store lap polylines

function initMap() {
    const mapOptions = {
        center: { lat: 39.8283, lng: -98.5795 }, // Center of the US
        zoom: 4,
    };
    map = new google.maps.Map(document.getElementById('map'), mapOptions);

    const kmlUpload = document.getElementById('kml-upload');
    kmlUpload.addEventListener('change', handleFileUpload);
}

function handleFileUpload(event) {
    clearLaps();

    const files = event.target.files;
    if (!files.length) {
        return;
    }

    const allPaths = [];
    let filesRead = 0;

    for (const file of files) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const kmlContent = e.target.result;
            const coordinates = parseKML(kmlContent);
            if (coordinates.length > 0) {
                drawLap(coordinates);
                allPaths.push(coordinates);
            }

            filesRead++;
            if (filesRead === files.length && allPaths.length > 0) {
                fitMapToLaps(allPaths);
            }
        };
        reader.readAsText(file);
    }
}

function drawLap(path) {
    const lapPolyline = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#FF0000', // Red color for the lap
        strokeOpacity: 0.8,
        strokeWeight: 2
    });
    lapPolyline.setMap(map);
    lapPolylines.push(lapPolyline);
}

function clearLaps() {
    for (let i = 0; i < lapPolylines.length; i++) {
        lapPolylines[i].setMap(null);
    }
    lapPolylines = [];
}

function fitMapToLaps(paths) {
    const bounds = new google.maps.LatLngBounds();
    paths.forEach(path => {
        path.forEach(point => {
            bounds.extend(point);
        });
    });
    if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
    }
}

function parseKML(kmlContent) {
    const parser = new DOMParser();
    const kml = parser.parseFromString(kmlContent, "application/xml");
    const coordinateNodes = kml.getElementsByTagName('coordinates');

    if (coordinateNodes.length === 0) {
        console.error("No <coordinates> element found in KML file.");
        return [];
    }

    // Assuming the first <coordinates> tag is the main lap data.
    const coordinatesText = coordinateNodes[0].textContent.trim();
    const coordinatesArray = coordinatesText.split(/\s+/);

    const path = coordinatesArray.map(coordStr => {
        const [lng, lat] = coordStr.split(',').map(Number);
        // KML coordinates are lng, lat, altitude. We only need lat and lng.
        return { lat: lat, lng: lng };
    }).filter(coord => !isNaN(coord.lat) && !isNaN(coord.lng)); // Filter out invalid coordinates

    return path;
}
